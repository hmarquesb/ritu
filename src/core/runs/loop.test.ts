import { describe, expect, it } from "vitest"
import { z } from "zod"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import type { MensagemDoLoop } from "./agent-runtime"
import type { DefinicaoDoAgente, ToolDeControle } from "./agente"
import {
  type DepsDoLoop,
  type EventoAoVivo,
  executarTrecho,
  novoCheckpoint,
  retomarCheckpoint,
} from "./loop"
import type { NovaEtapa } from "./ports"

const ctx = {} as unknown as ToolContext

const toolA = definirTool({
  name: "a",
  description: "A",
  input: z.object({ x: z.number() }),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const toolB = definirTool({
  name: "b",
  description: "B",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const toolQuebra = definirTool({
  name: "quebra",
  description: "Q",
  input: z.object({}),
  output: z.object({}),
  executar: (): Record<string, never> => {
    throw new Error("segredo da pessoa")
  },
})
const toolGrande = definirTool({
  name: "grande",
  description: "G",
  input: z.object({}),
  output: z.object({ texto: z.string() }),
  executar: () => ({ texto: "x".repeat(5000) }),
})
const toolComResumo = {
  ...toolB,
  name: "resumida",
  resumir: () => "r".repeat(120),
}

const finalizar: ToolDeControle<unknown> = {
  name: "finalizar",
  description: "entrega",
  input: z.object({ ok: z.boolean().optional() }),
  async tratar(input) {
    if ((input as { ok?: boolean }).ok === false) {
      return { tipo: "recusar", resultado: { violacoes: ["x"] } }
    }
    return { tipo: "entregar", saida: { texto: "oi" } }
  },
}
const perguntar: ToolDeControle<unknown> = {
  name: "perguntar",
  description: "pergunta",
  input: z.object({}),
  async tratar() {
    return { tipo: "pausar", pendencia: { tipo: "pergunta", conteudo: { q: 1 } } }
  },
}
const perguntarComResumo: ToolDeControle<unknown> = {
  name: "perguntar_resumo",
  description: "pergunta com resumo",
  input: z.object({}),
  async tratar() {
    return {
      tipo: "pausar",
      pendencia: { tipo: "pergunta", conteudo: { q: 1 } },
      resumo: `casa: 2 itens${"x".repeat(100)}`,
    }
  },
}
const finalizarResumo: ToolDeControle<unknown> = {
  name: "finalizar_resumo",
  description: "recusa com resumo",
  input: z.object({}),
  async tratar() {
    return { tipo: "recusar", resultado: { entregue: false }, resumo: "a,b" }
  },
}
const encerrar: ToolDeControle<unknown> = {
  name: "encerrar",
  description: "encerra com erro",
  input: z.object({}),
  async tratar() {
    return { tipo: "encerrar", codigo: "montagem", resumo: "erro_de_montagem" }
  },
}
const aprovar: ToolDeControle<unknown> = {
  name: "aprovar",
  description: "aprovação",
  input: z.object({}),
  async tratar() {
    return { tipo: "pausar", pendencia: { tipo: "aprovacao", conteudo: {} } }
  },
}

const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [toolA, toolB, toolQuebra, toolGrande, toolComResumo] as never,
  controle: [finalizar, perguntar, perguntarComResumo, finalizarResumo, encerrar, aprovar],
  lembreteDeEntrega: "entregue por finalizar",
}

function montar(roteiro: PassoRoteirizado[], modelos?: string[]) {
  const clock = createFixedClock("2026-01-01T12:00:00Z")
  const runtime = createScriptedRuntime(roteiro, clock)
  const modelo = createFixedModel(modelos)
  const telemetry = createMemoryTelemetry()
  const etapas: NovaEtapa[] = []
  const eventos: EventoAoVivo[] = []
  const deps: DepsDoLoop = {
    runtime,
    modelo,
    clock,
    telemetry,
    gravarEtapa: async (e) => {
      etapas.push(e)
      return undefined
    },
    aoVivo: (e) => eventos.push(e),
  }
  return { clock, runtime, modelo, telemetry, etapas, eventos, deps }
}

const inicio = () => novoCheckpoint(agente, "mensagem", { d: 1 })
const fin = { nome: "finalizar", argumentos: {} }

describe("executarTrecho", () => {
  it("o resultado de uma tool já está nas mensagens quando a seguinte do passo roda", async () => {
    const vistas: MensagemDoLoop[][] = []
    const espia: ToolDeControle<unknown> = {
      name: "espia",
      description: "registra as mensagens",
      input: z.object({}),
      async tratar(_entrada, _ctx, estado) {
        vistas.push([...estado.mensagens])
        return { tipo: "recusar", resultado: { ok: true } }
      },
    }
    const comEspia: DefinicaoDoAgente = { ...agente, controle: [...agente.controle, espia] }
    const m = montar([
      {
        chamadas: [
          { nome: "a", argumentos: { x: 1 } },
          { nome: "espia", argumentos: {} },
        ],
      },
      { chamadas: [fin] },
    ])

    await executarTrecho(comEspia, novoCheckpoint(comEspia, "mensagem", { d: 1 }), ctx, m.deps)

    expect(vistas).toHaveLength(1)
    expect(
      vistas[0]?.filter((x) => x.papel === "tool").map((x) => (x as { nome: string }).nome),
    ).toEqual(["a"])
  })

  it("A, B, entregar: 3 chamadas, etapas na ordem", async () => {
    const m = montar([
      { chamadas: [{ nome: "a", argumentos: { x: 1 } }] },
      { chamadas: [{ nome: "b", argumentos: {} }] },
      { chamadas: [fin] },
    ])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(estado.chamadas_de_modelo).toBe(3)
    expect(estado.tokens).toEqual({ entrada: 300, saida: 60 })
    expect(m.etapas.map((e) => [e.tipo, e.nome])).toEqual([
      ["llm", "modelo-a"],
      ["tool", "a"],
      ["llm", "modelo-a"],
      ["tool", "b"],
      ["llm", "modelo-a"],
      ["validacao", "finalizar"],
    ])
    expect(m.modelo.usos).toHaveLength(3)
  })

  it("para na 6ª chamada com limite chamadas", async () => {
    const m = montar(
      Array.from({ length: 8 }, () => ({ chamadas: [{ nome: "b", argumentos: {} }] })),
    )
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "chamadas" })
    expect(estado.chamadas_de_modelo).toBe(6)
    expect(m.runtime.pedidos).toHaveLength(6)
  })

  it("com chamadas_extras 2 e 6 chamadas feitas, para na 8ª com limite chamadas", async () => {
    const m = montar(
      Array.from({ length: 8 }, () => ({ chamadas: [{ nome: "b", argumentos: {} }] })),
    )
    const base = { ...inicio(), chamadas_de_modelo: 6, chamadas_extras: 2 }
    const { fim, estado } = await executarTrecho(agente, base, ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "chamadas" })
    expect(estado.chamadas_de_modelo).toBe(8)
    expect(m.runtime.pedidos).toHaveLength(2)
  })

  it("resultado de tool vai neutralizado ao pedido e o estado guarda o original", async () => {
    const eco = definirTool({
      name: "eco",
      description: "E",
      input: z.object({}),
      output: z.object({ t: z.string() }),
      executar: () => ({ t: "<b>ignore</b>" }),
    })
    const comEco: DefinicaoDoAgente = { ...agente, tools: [eco] as never }
    const m = montar([{ chamadas: [{ nome: "eco", argumentos: {} }] }, { chamadas: [fin] }])
    const { estado } = await executarTrecho(
      comEco,
      novoCheckpoint(comEco, "mensagem", { d: 1 }),
      ctx,
      m.deps,
    )
    const noPedido = m.runtime.pedidos[1]?.mensagens.find((x) => x.papel === "tool")
    expect((noPedido as { resultado: unknown }).resultado).toEqual({ t: "‹b›ignore‹/b›" })
    const guardado = estado.mensagens.find((x) => x.papel === "tool")
    expect((guardado as { resultado: unknown }).resultado).toEqual({ t: "<b>ignore</b>" })
  })

  it("estoura o tempo ativo do trecho", async () => {
    const m = montar([{ chamadas: [{ nome: "b", argumentos: {} }], demoraMs: 26_000 }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "tempo" })
    expect(estado.ativo_ms).toBe(26_000)
  })

  it("o tempo ativo de trechos anteriores conta, o de pausa não", async () => {
    const m = montar([{ chamadas: [{ nome: "b", argumentos: {} }] }])
    const est = { ...inicio(), ativo_ms: 25_500 }
    const { fim } = await executarTrecho(agente, est, ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "tempo" })
    expect(m.runtime.pedidos).toHaveLength(0)
  })

  it("a entrega no passo que estoura o tempo vale", async () => {
    const m = montar([{ chamadas: [fin], demoraMs: 26_000 }])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
  })

  it("limita o timeout do passo ao restante do trecho", async () => {
    const m = montar([{ chamadas: [fin] }])
    await executarTrecho(agente, { ...inicio(), ativo_ms: 20_000 }, ctx, m.deps)
    expect(m.runtime.pedidos[0]?.timeoutMs).toBe(5_000)
  })

  it("estoura o teto de tokens", async () => {
    const m = montar([
      { chamadas: [{ nome: "b", argumentos: {} }], tokens: { entrada: 59_000, saida: 2_000 } },
      { chamadas: [fin] },
    ])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "tokens" })
  })

  it("3 recusas encerram com limite validacao", async () => {
    const recusa = { nome: "finalizar", argumentos: { ok: false } }
    const m = montar([{ chamadas: [recusa] }, { chamadas: [recusa] }, { chamadas: [recusa] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "limite", motivo: "validacao" })
    expect(estado.entregas_recusadas).toBe(3)
    const msgs = estado.mensagens.filter((x) => x.papel === "tool")
    expect(msgs[0]).toMatchObject({ resultado: { violacoes: ["x"] } })
    expect(m.etapas.filter((e) => e.status === "recusado")).toHaveLength(3)
  })

  it("tool desconhecida vira resultado e etapa recusada", async () => {
    const m = montar([{ chamadas: [{ nome: "zzz", argumentos: {} }] }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(estado.mensagens).toContainEqual(
      expect.objectContaining({ papel: "tool", resultado: { erro: "tool_desconhecida" } }),
    )
    expect(m.etapas.find((e) => e.nome === "zzz")?.status).toBe("recusado")
    expect(m.telemetry.spans.find((s) => s.nome === "tool.chamada")?.atributos["tool.nome"]).toBe(
      "desconhecida",
    )
  })

  it("argumento inválido vira recusado", async () => {
    const m = montar([{ chamadas: [{ nome: "a", argumentos: { x: "n" } }] }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(estado.mensagens).toContainEqual(
      expect.objectContaining({ resultado: { erro: "argumentos_invalidos" } }),
    )
    expect(m.etapas.find((e) => e.nome === "a")).toMatchObject({ tipo: "tool", status: "recusado" })
  })

  it("tool que lança vira falhou, sem vazar a mensagem", async () => {
    const m = montar([{ chamadas: [{ nome: "quebra", argumentos: {} }] }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(JSON.stringify(estado.mensagens)).not.toContain("segredo")
    expect(m.etapas.find((e) => e.nome === "quebra")?.status).toBe("falhou")
  })

  it("passo sem tool recebe o lembrete e conta chamada", async () => {
    const m = montar([{ texto: "oi" }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(estado.chamadas_de_modelo).toBe(2)
    expect(m.runtime.pedidos[1]?.mensagens.at(-1)).toEqual({
      papel: "sistema",
      conteudo: "entregue por finalizar",
    })
  })

  it("pausa e retomada sem repetir pedidos ao runtime", async () => {
    const m = montar([{ chamadas: [{ nome: "perguntar", argumentos: {} }] }, { chamadas: [fin] }])
    const primeiro = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(primeiro.fim).toMatchObject({
      tipo: "pausa",
      pendencia: { tipo: "pergunta", chamada_id: "c1", conteudo: { q: 1 } },
    })
    expect(m.runtime.pedidos).toHaveLength(1)
    expect(m.etapas.at(-1)?.tipo).toBe("pergunta")
    expect(m.telemetry.eventos).toEqual([
      { nome: "pausa", atributos: { "pausa.tipo": "pergunta" } },
    ])
    if (primeiro.fim.tipo !== "pausa") throw new Error("esperava pausa")

    const retomado = retomarCheckpoint(primeiro.estado, primeiro.fim.pendencia, { resposta: "sim" })
    expect(retomado.pausas).toBe(1)
    expect(retomado.mensagens.at(-1)).toEqual({
      papel: "tool",
      chamada_id: "c1",
      nome: "perguntar",
      resultado: { resposta: "sim" },
    })
    const segundo = await executarTrecho(agente, retomado, ctx, m.deps)
    expect(segundo.fim.tipo).toBe("entregue")
    expect(m.runtime.pedidos).toHaveLength(2)
    expect(segundo.estado.chamadas_de_modelo).toBe(2)
  })

  it("pausa de aprovação grava etapa proposta", async () => {
    const m = montar([{ chamadas: [{ nome: "aprovar", argumentos: {} }] }])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("pausa")
    expect(m.etapas.at(-1)?.tipo).toBe("proposta")
  })

  it("rate_limit troca de modelo sem contar chamada", async () => {
    const m = montar([{ erro: "rate_limit" }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(estado.chamadas_de_modelo).toBe(1)
    expect(m.runtime.pedidos.map((p) => p.modelo)).toEqual(["modelo-a", "modelo-b"])
    expect(m.etapas.map((e) => e.tipo)).toEqual(["troca_de_modelo", "llm", "validacao"])
    const llm = m.telemetry.spans.find((s) => s.nome === "llm.chamada")
    expect(llm?.atributos).toMatchObject({
      "gen_ai.request.model": "modelo-b",
      "llm.troca_de_modelo": true,
      "llm.tentativas": 2,
    })
    // o erro é contado pelo roteador, em `falhou`; o loop não soma de novo
    expect(m.telemetry.metricas.some((x) => x.nome === "ritu_llm_erros_total")).toBe(false)
  })

  it("llm.chamada leva o papel e llm.troca_de_modelo false quando não houve troca", async () => {
    const m = montar([{ chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const llm = m.telemetry.spans.find((s) => s.nome === "llm.chamada")
    expect(llm?.atributos).toMatchObject({ "llm.papel": "decisao", "llm.troca_de_modelo": false })
  })

  it("rate_limit sem próximo modelo termina em sem_modelo", async () => {
    const m = montar([{ erro: "rate_limit" }], ["so-um"])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "sem_modelo" })
  })

  it("timeout uma vez tenta de novo no mesmo modelo, contando chamada", async () => {
    const m = montar([{ erro: "timeout" }, { chamadas: [fin] }])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    expect(estado.chamadas_de_modelo).toBe(2)
    expect(m.runtime.pedidos.map((p) => p.modelo)).toEqual(["modelo-a", "modelo-a"])
  })

  it("timeout duas vezes encerra com erro", async () => {
    const m = montar([{ erro: "timeout" }, { erro: "timeout" }])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "erro", codigo: "timeout" })
    expect(m.etapas.at(-1)).toMatchObject({ tipo: "erro", status: "falhou" })
  })

  it("mais de 4 tools no passo: excedentes recebem muitas_tools", async () => {
    const b = { nome: "b", argumentos: {} }
    const m = montar([{ chamadas: [b, b, b, b, b, b] }, { chamadas: [fin] }])
    const { estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    const msgs = estado.mensagens.filter((x) => x.papel === "tool")
    expect(
      msgs.filter((x) => (x.resultado as { erro?: string }).erro === "muitas_tools"),
    ).toHaveLength(2)
    expect(m.etapas.filter((e) => e.tipo === "tool")).toHaveLength(4)
  })

  it("corta resultado grande", async () => {
    const m = montar([{ chamadas: [{ nome: "grande", argumentos: {} }] }, { chamadas: [fin] }])
    const { estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    const r = estado.mensagens.find((x) => x.papel === "tool")?.resultado as {
      cortado: boolean
      parcial: string
    }
    expect(r.cortado).toBe(true)
    expect(r.parcial).toHaveLength(4_000)
  })

  it("duas tools de controle no mesmo passo: vale a primeira", async () => {
    const m = montar([
      { chamadas: [fin, { nome: "perguntar", argumentos: {} }, { nome: "b", argumentos: {} }] },
    ])
    const { fim, estado } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim.tipo).toBe("entregue")
    const msgs = estado.mensagens.filter((x) => x.papel === "tool")
    expect(msgs.map((x) => x.resultado)).toEqual([
      { entregue: true },
      { ignorada: true },
      { ignorada: true },
    ])
    expect(m.etapas.filter((e) => e.tipo === "pergunta" || e.tipo === "tool")).toHaveLength(0)
  })

  it("a pausa leva o resumo (cortado em 80) para a etapa pergunta; sem resumo, null", async () => {
    const com = montar([{ chamadas: [{ nome: "perguntar_resumo", argumentos: {} }] }])
    await executarTrecho(agente, inicio(), ctx, com.deps)
    const etapaCom = com.etapas.find((e) => e.tipo === "pergunta")
    expect(etapaCom?.resumo).toHaveLength(80)
    expect(etapaCom?.resumo?.startsWith("casa: 2 itens")).toBe(true)
    const sem = montar([{ chamadas: [{ nome: "perguntar", argumentos: {} }] }])
    await executarTrecho(agente, inicio(), ctx, sem.deps)
    expect(sem.etapas.find((e) => e.tipo === "pergunta")?.resumo).toBeNull()
  })

  it("o resumo de entregar e de recusar vai para a etapa validacao", async () => {
    const m = montar([
      { chamadas: [{ nome: "finalizar_resumo", argumentos: {} }] },
      { chamadas: [fin] },
    ])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(m.etapas.filter((e) => e.tipo === "validacao").map((e) => e.resumo)).toEqual([
      "a,b",
      null,
    ])
  })

  it("controle encerrar fecha o trecho com erro e a etapa validacao falhou", async () => {
    const m = montar([{ chamadas: [{ nome: "encerrar", argumentos: {} }] }])
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "erro", codigo: "montagem" })
    expect(m.etapas.filter((e) => e.tipo === "validacao")).toEqual([
      expect.objectContaining({ nome: "encerrar", status: "falhou", resumo: "erro_de_montagem" }),
    ])
  })

  it("resume com 80 caracteres no máximo", async () => {
    const m = montar([{ chamadas: [{ nome: "resumida", argumentos: {} }] }, { chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(m.etapas.find((e) => e.nome === "resumida")?.resumo).toHaveLength(80)
  })

  it("pensamento cortado em 160 só vai ao vivo", async () => {
    const texto = `PENSA${"p".repeat(300)}`
    const m = montar([{ texto, chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const pensamento = m.eventos.find((e) => e.tipo === "pensamento")
    expect(pensamento).toMatchObject({ texto: texto.slice(0, 160) })
    const rastro = JSON.stringify([
      m.etapas,
      m.telemetry.spans,
      m.telemetry.metricas,
      m.telemetry.logs,
    ])
    expect(rastro).not.toContain("PENSA")
  })

  it("eventos ao vivo: iniciada antes, concluída depois", async () => {
    const m = montar([{ chamadas: [{ nome: "a", argumentos: { x: 1 } }] }, { chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const seq = m.eventos.map((e) =>
      e.tipo === "etapa_iniciada"
        ? `i:${e.etapa.tipo}`
        : e.tipo === "etapa_concluida"
          ? `c:${e.etapa.tipo}`
          : "p",
    )
    expect(seq).toEqual([
      "i:llm",
      "c:llm",
      "i:tool",
      "c:tool",
      "i:llm",
      "c:llm",
      "i:validacao",
      "c:validacao",
    ])
  })

  it("usa a etapa devolvida por gravarEtapa em etapa_concluida", async () => {
    const m = montar([{ chamadas: [fin] }])
    let ordem = 0
    m.deps.gravarEtapa = async (e) => ({
      ...e,
      run_id: "r1",
      ordem: ++ordem,
      criado_em: "2026-01-01T00:00:00Z",
    })
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const concluida = m.eventos.find((e) => e.tipo === "etapa_concluida")
    expect(concluida).toMatchObject({ etapa: { run_id: "r1", ordem: 1 } })
  })

  it("árvore de spans e métricas", async () => {
    const m = montar([{ chamadas: [{ nome: "a", argumentos: { x: 1 } }] }, { chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const arvore = m.telemetry.spans.map((s) => [s.nome, s.pai])
    expect(arvore).toEqual([
      ["agente.passo", undefined],
      ["llm.chamada", 0],
      ["tool.chamada", 0],
      ["agente.passo", undefined],
      ["llm.chamada", 3],
      ["tool.chamada", 3],
    ])
    expect(m.telemetry.spans[0]?.atributos).toEqual({ "passo.ordem": 1 })
    expect(m.telemetry.spans[1]?.atributos).toMatchObject({
      "gen_ai.request.model": "modelo-a",
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 20,
      "llm.tentativas": 1,
    })
    expect(m.telemetry.spans[2]?.atributos).toEqual({ "tool.nome": "a", "tool.status": "ok" })
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_tool_chamadas_total")).toHaveLength(
      2,
    )
  })

  it("exceção inesperada vira erro inesperado", async () => {
    const m = montar([{ chamadas: [fin] }])
    m.deps.gravarEtapa = async () => {
      throw new Error("banco")
    }
    const { fim } = await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(fim).toEqual({ tipo: "erro", codigo: "inesperado" })
  })

  it("não altera o checkpoint recebido", async () => {
    const m = montar([{ chamadas: [fin] }])
    const e = inicio()
    await executarTrecho(agente, e, ctx, m.deps)
    expect(e.mensagens).toHaveLength(1)
    expect(e.chamadas_de_modelo).toBe(0)
  })

  it("grava a duração da tool e passa a duração do modelo a usou", async () => {
    const m = montar([{ chamadas: [{ nome: "a", argumentos: { x: 1 } }] }, { chamadas: [fin] }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    const h = m.telemetry.metricas.filter((x) => x.nome === "ritu_tool_duracao_ms")
    expect(h.map((x) => x.rotulos)).toEqual([{ tool: "a" }, { tool: "finalizar" }])
    expect(m.modelo.usos.every((u) => typeof u.duracaoMs === "number")).toBe(true)
  })

  it("um LlmError no passo não soma ritu_llm_erros_total no loop", async () => {
    const m = montar([{ erro: "timeout" }, { erro: "timeout" }])
    await executarTrecho(agente, inicio(), ctx, m.deps)
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_llm_erros_total")).toHaveLength(0)
    expect(m.modelo.falhas).toHaveLength(2)
  })
})
