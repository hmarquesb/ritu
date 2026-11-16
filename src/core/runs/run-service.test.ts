import { describe, expect, it } from "vitest"
import { z } from "zod"
import { definirTool, type ToolContext } from "@/core/tools/tool"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import type { DefinicaoDoAgente, ToolDeControle } from "./agente"
import { RunAbertoError, RunNaoContinuavelError } from "./errors"
import { novoCheckpoint } from "./loop"
import type { RunEtapa } from "./ports"
import { createRunService } from "./run-service"

const ctx = {} as unknown as ToolContext
const MENSAGEM = "mensagem secreta da pessoa"

const toolA = definirTool({
  name: "a",
  description: "A",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  executar: () => ({ ok: true }),
})
const finalizar: ToolDeControle<unknown> = {
  name: "finalizar",
  description: "entrega",
  input: z.object({}),
  async tratar() {
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
  aoRetomar: (resposta) => ({ resposta }),
}
const agente: DefinicaoDoAgente = {
  nome: "teste",
  instrucoes: "instr",
  prompt_versao: "v1",
  tools: [toolA] as never,
  controle: [finalizar, perguntar],
  lembreteDeEntrega: "entregue",
}
const fin = { nome: "finalizar", argumentos: {} }
const perg = { nome: "perguntar", argumentos: {} }

async function montar(roteiro: PassoRoteirizado[]) {
  const clock = createFixedClock("2026-01-01T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(roteiro, clock)
  const modelo = createFixedModel()
  const svc = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const etapas: RunEtapa[] = []
  const exec = { agente, ctx, modelo, aoGravarEtapa: (e: RunEtapa) => etapas.push(e) }
  const iniciar = () => svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
  return { clock, stores, telemetry, svc, conta, etapas, exec, iniciar }
}

const estadoInicial = () => novoCheckpoint(agente, MENSAGEM, {})

describe("createRunService", () => {
  it("fluxo inteiro até done, via encerrar", async () => {
    const m = await montar([{ chamadas: [{ nome: "a", argumentos: {} }] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    const r = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(r.fim).toEqual({ tipo: "entregue", saida: { texto: "oi" } })
    expect(r.run).toMatchObject({
      status: "running",
      saida: { texto: "oi" },
      passos: 2,
      tokens_entrada: 200,
      tokens_saida: 40,
      prompt_versao: "v1",
    })
    expect(r.run.trace_id).toBeTruthy()
    await m.svc.encerrar(m.conta.id, run.id, "done")
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
    expect(m.etapas.map((e) => e.ordem)).toEqual([1, 2, 3, 4])
    expect(m.etapas.map((e) => e.tipo)).toEqual(["llm", "tool", "llm", "validacao"])
    expect(m.telemetry.logs.map((l) => l.codigo)).toEqual(["run_inicio", "run_fim"])
  })

  it("pausa e continua até done, no mesmo trace", async () => {
    const m = await montar([{ chamadas: [perg] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    const p = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(p.fim.tipo).toBe("pausa")
    expect(p.run.status).toBe("waiting_for_input")
    expect(p.run.checkpoint).toMatchObject({ versao: 1, chamadas_de_modelo: 1 })
    expect(p.run.pendencia).toMatchObject({ tipo: "pergunta", chamada_id: "c1" })
    expect(m.telemetry.eventos).toHaveLength(1)
    expect((p.run.pendencia as { criada_em: string }).criada_em).toBe("2026-01-01T12:00:00.000Z")

    const c = await m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "sim" })
    expect(c.fim.tipo).toBe("entregue")
    expect(c.run.passos).toBe(2)
    const raizes = m.telemetry.spans.filter((s) => s.nome === "run")
    expect(raizes).toHaveLength(2)
    expect(new Set(m.telemetry.spans.map((s) => s.trace)).size).toBe(1)
    await m.svc.encerrar(m.conta.id, run.id, "done")
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
  })

  it.each(["done", "expired"] as const)("continuarRun em %s lança e não muda nada", async (st) => {
    const m = await montar([])
    const run = await m.iniciar()
    await m.stores.runs.atualizar(m.conta.id, run.id, { status: st })
    await expect(
      m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "x" }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe(st)
  })

  it("continuarRun de outra conta lança e não muda nada", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const outra = await m.stores.accounts.criar({ tipo: "demo" })
    await expect(
      m.svc.continuarRun(outra.id, run.id, { ...m.exec, resposta: "x" }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("waiting_for_input")
  })

  it("continuarRun em running sem reservado lança e não muda nada", async () => {
    const m = await montar([])
    const run = await m.iniciar()
    await expect(
      m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "x" }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("running")
  })

  it("continuarRun reservado em running retoma do checkpoint sem repetir passo", async () => {
    const m = await montar([{ chamadas: [perg] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(
      await m.stores.runs.mudarStatusSe(m.conta.id, run.id, "waiting_for_input", "running"),
    ).toBe(true)
    const c = await m.svc.continuarRun(m.conta.id, run.id, {
      ...m.exec,
      resposta: "sim",
      reservado: true,
    })
    expect(c.fim.tipo).toBe("entregue")
    expect(c.run.passos).toBe(2)
  })

  it("continuarRun reservado em waiting_for_input lança e não muda nada", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    await expect(
      m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "x", reservado: true }),
    ).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("waiting_for_input")
  })

  describe("pausarSemAgente", () => {
    const pendencia = { tipo: "pergunta" as const, conteudo: { q: 1 } }

    it("deixa o run em waiting_for_input, sem checkpoint, com evento e métrica", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      const r = await m.svc.pausarSemAgente(m.conta.id, run.id, pendencia)
      expect(r).toMatchObject({ status: "waiting_for_input", checkpoint: null })
      expect(r.pendencia).toEqual({ ...pendencia, criada_em: "2026-01-01T12:00:00.000Z" })
      expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("waiting_for_input")
      expect(m.telemetry.eventos).toHaveLength(1)
      expect(m.telemetry.eventos[0]).toMatchObject({ nome: "pausa" })
      expect(
        m.telemetry.metricas.filter((x) => x.nome === "ritu_pausas_total").map((x) => x.valor),
      ).toEqual([1])
    })

    it("em run done lança", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      await m.svc.encerrar(m.conta.id, run.id, "done")
      await expect(m.svc.pausarSemAgente(m.conta.id, run.id, pendencia)).rejects.toThrow()
    })

    it("aprovacao leva a waiting_for_approval, mantém o checkpoint e grava os campos", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      const checkpoint = { versao: 1, marca: "x" }
      await m.stores.runs.atualizar(m.conta.id, run.id, { checkpoint })
      const r = await m.svc.pausarSemAgente(
        m.conta.id,
        run.id,
        { tipo: "aprovacao", conteudo: { ids: [1] } },
        { saida: { qualquer: true } },
      )
      expect(r).toMatchObject({ status: "waiting_for_approval", checkpoint })
      expect(r.pendencia).toEqual({
        tipo: "aprovacao",
        conteudo: { ids: [1] },
        criada_em: "2026-01-01T12:00:00.000Z",
      })
      expect(r.saida).toEqual({ qualquer: true })
      expect(m.telemetry.eventos).toHaveLength(1)
      expect(m.telemetry.eventos[0]).toMatchObject({ nome: "pausa" })
      expect(m.telemetry.eventos[0]?.atributos).toMatchObject({ "pausa.tipo": "aprovacao" })
      const pausas = m.telemetry.metricas.filter((x) => x.nome === "ritu_pausas_total")
      expect(pausas).toHaveLength(1)
      expect(pausas[0]?.rotulos).toMatchObject({ tipo: "aprovacao" })
    })

    it("pergunta grava também os campos", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      const r = await m.svc.pausarSemAgente(m.conta.id, run.id, pendencia, { saida: { a: 1 } })
      expect(r).toMatchObject({ status: "waiting_for_input", checkpoint: null, saida: { a: 1 } })
    })

    it("aprovacao em run done lança", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      await m.svc.encerrar(m.conta.id, run.id, "done")
      await expect(
        m.svc.pausarSemAgente(m.conta.id, run.id, { tipo: "aprovacao", conteudo: {} }),
      ).rejects.toThrow()
    })
  })

  it("checkpoint corrompido vira failed, sem exceção", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    await m.stores.runs.atualizar(m.conta.id, run.id, { checkpoint: { versao: 9 } })
    const c = await m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "x" })
    expect(c.run.status).toBe("failed")
    expect(c.fim).toEqual({ tipo: "erro", codigo: "checkpoint_invalido" })
    expect((await m.stores.runs.etapas(m.conta.id, run.id)).at(-1)?.tipo).toBe("erro")
  })

  it("prompt_versao diferente vira failed com checkpoint_incompativel", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const c = await m.svc.continuarRun(m.conta.id, run.id, {
      ...m.exec,
      agente: { ...agente, prompt_versao: "v2" },
      resposta: "x",
    })
    expect(c.run.status).toBe("failed")
    expect(c.fim).toEqual({ tipo: "erro", codigo: "checkpoint_incompativel" })
  })

  it("mensagem nova com run em waiting_for_input cancela o antigo", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const novo = await m.iniciar()
    expect(novo.id).not.toBe(run.id)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("cancelled")
  })

  it("com waiting_for_approval, o antigo vira done e a proposta pendente, expirada", async () => {
    const m = await montar([])
    const run = await m.iniciar()
    const [prop] = await m.stores.proposals.criar(m.conta.id, run.id, [{ tool: "t", conteudo: {} }])
    await m.stores.runs.atualizar(m.conta.id, run.id, { status: "waiting_for_approval" })
    await m.iniciar()
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
    const props = await m.stores.proposals.doRun(m.conta.id, run.id)
    expect(props.find((x) => x.id === prop?.id)?.decisao).toBe("expirada")
  })

  it("com run em running, iniciarRun lança RunAbertoError", async () => {
    const m = await montar([])
    await m.iniciar()
    await expect(m.iniciar()).rejects.toBeInstanceOf(RunAbertoError)
  })

  it("transição inválida lança transicao_invalida", async () => {
    const m = await montar([])
    const run = await m.iniciar()
    await m.svc.encerrar(m.conta.id, run.id, "done")
    await expect(m.svc.encerrar(m.conta.id, run.id, "failed")).rejects.toMatchObject({
      code: "transicao_invalida",
    })
  })

  it("executarRun que entrega devolve o estado do trecho", async () => {
    const m = await montar([{ chamadas: [{ nome: "a", argumentos: {} }] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    const r = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(r.estado?.chamadas_de_modelo).toBe(2)
    expect(r.estado?.tokens).toEqual({ entrada: 200, saida: 40 })
    expect(r.estado?.mensagens.some((x) => x.papel === "tool")).toBe(true)
  })

  it("continuarRun que entrega devolve o estado do trecho", async () => {
    const m = await montar([{ chamadas: [perg] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const r = await m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "ok" })
    expect(r.fim.tipo).toBe("entregue")
    expect(r.estado?.chamadas_de_modelo).toBe(2)
  })

  it("corpo que lança devolve o resultado sem estado", async () => {
    const m = await montar([{ chamadas: [fin] }])
    const run = await m.iniciar()
    const original = m.telemetry.histograma.bind(m.telemetry)
    m.telemetry.histograma = (nome, ...resto) => {
      if (nome === "ritu_run_duracao_ms") throw new Error("boom")
      original(nome, ...resto)
    }
    const r = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(r.estado).toBeUndefined()
  })

  it("exceção inesperada leva o run a failed", async () => {
    const m = await montar([{ chamadas: [fin] }])
    const run = await m.iniciar()
    const original = m.telemetry.histograma.bind(m.telemetry)
    m.telemetry.histograma = (nome, ...resto) => {
      if (nome === "ritu_run_duracao_ms") throw new Error("boom")
      original(nome, ...resto)
    }
    const r = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(r.run.status).toBe("failed")
    expect(r.fim).toEqual({ tipo: "erro", codigo: "inesperado" })
  })

  it("aoGravarEtapa é chamado na ordem e nenhum atributo contém a mensagem", async () => {
    const m = await montar([{ chamadas: [{ nome: "a", argumentos: {} }] }, { chamadas: [fin] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const gravadas = await m.stores.runs.etapas(m.conta.id, run.id)
    expect(m.etapas).toEqual(gravadas)
    const tudo = JSON.stringify([m.telemetry.spans, m.telemetry.logs, m.telemetry.metricas])
    expect(tudo).not.toContain(MENSAGEM)
    const nomes = m.telemetry.spans.map((s) => s.nome)
    expect(nomes[0]).toBe("run")
    expect(nomes).toContain("agente.passo")
    expect(nomes).toContain("llm.chamada")
    expect(nomes).toContain("tool.chamada")
  })

  it("aoRetomar que lança leva o run a failed", async () => {
    const m = await montar([{ chamadas: [perg] }])
    const run = await m.iniciar()
    await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    const quebra = {
      ...agente,
      controle: [
        finalizar,
        {
          ...perguntar,
          aoRetomar: () => {
            throw new Error("x")
          },
        },
      ],
    }
    const c = await m.svc.continuarRun(m.conta.id, run.id, {
      ...m.exec,
      agente: quebra,
      resposta: "x",
    })
    expect(c.run.status).toBe("failed")
    expect(c.fim).toEqual({ tipo: "erro", codigo: "inesperado" })
    await expect(m.iniciar()).resolves.toBeTruthy()
  })

  it("grava latencia_ms, passos e tokens também em fim limite", async () => {
    const passos = Array.from({ length: 6 }, () => ({
      chamadas: [{ nome: "a", argumentos: {} }],
      demoraMs: 1000,
    }))
    const m = await montar(passos)
    const run = await m.iniciar()
    const r = await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
    expect(r.fim).toEqual({ tipo: "limite", motivo: "chamadas" })
    expect(r.run).toMatchObject({ passos: 6, latencia_ms: 6000, tokens_entrada: 600 })
  })

  describe("medição e encerramento", () => {
    const duracoes = (m: Awaited<ReturnType<typeof montar>>) =>
      m.telemetry.metricas.filter((x) => x.nome === "ritu_run_duracao_ms")

    it("comSpanDoRun sem agente grava uma duração com o status do fim", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      await m.svc.comSpanDoRun(m.conta.id, run.id, async () => {
        m.clock.advance(250)
        await m.svc.pausarSemAgente(m.conta.id, run.id, { tipo: "pergunta", conteudo: {} })
      })
      expect(duracoes(m)).toEqual([
        {
          tipo: "histograma",
          nome: "ritu_run_duracao_ms",
          valor: 250,
          rotulos: { caminho: "acompanhante", status: "waiting_for_input" },
        },
      ])
    })

    it("executarRun direto grava uma duração", async () => {
      const m = await montar([{ chamadas: [fin], demoraMs: 400 }])
      const run = await m.iniciar()
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      expect(duracoes(m)).toHaveLength(1)
      expect(duracoes(m)[0]?.rotulos).toEqual({ caminho: "acompanhante", status: "running" })
    })

    it("continuarRun dentro de comSpanDoRun grava uma só", async () => {
      const m = await montar([{ chamadas: [perg] }, { chamadas: [fin] }])
      const run = await m.iniciar()
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      expect(duracoes(m)).toHaveLength(1)
      await m.svc.comSpanDoRun(m.conta.id, run.id, () =>
        m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "sim" }),
      )
      expect(duracoes(m)).toHaveLength(2)
    })

    it("encerrar done grava passos uma vez e run_fim com os campos", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.iniciar()
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      await m.svc.encerrar(m.conta.id, run.id, "done")
      const passos = m.telemetry.metricas.filter((x) => x.nome === "ritu_run_passos")
      expect(passos).toHaveLength(1)
      expect(passos[0]).toMatchObject({
        valor: 1,
        rotulos: { caminho: "acompanhante", status: "done" },
      })
      expect(m.telemetry.logs.find((l) => l.codigo === "run_fim")?.campos).toMatchObject({
        "run.id": run.id,
        "run.status": "done",
        "run.caminho": "acompanhante",
        "run.passos": 1,
      })
    })

    it("falha inesperada loga run_falhou com o código", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.iniciar()
      const original = m.telemetry.histograma.bind(m.telemetry)
      m.telemetry.histograma = (nome, ...resto) => {
        if (nome === "ritu_run_duracao_ms") throw new Error("boom")
        original(nome, ...resto)
      }
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      expect(m.telemetry.logs.find((l) => l.codigo === "run_falhou")?.campos).toEqual({
        "run.id": run.id,
        "erro.codigo": "inesperado",
      })
    })

    it("continuar loga run_retomado com pausa.tipo", async () => {
      const m = await montar([{ chamadas: [perg] }, { chamadas: [fin] }])
      const run = await m.iniciar()
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      await m.svc.continuarRun(m.conta.id, run.id, { ...m.exec, resposta: "sim" })
      const logs = m.telemetry.logs.map((l) => l.codigo)
      expect(logs).toEqual(["run_inicio", "run_retomado"])
      expect(m.telemetry.logs[1]?.campos).toMatchObject({ "pausa.tipo": "pergunta" })
    })

    it("span run aberto por dentroDoSpan tem caminho e intencoes no fim", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.svc.iniciarRun(m.conta.id, {
        caminho: "acompanhante",
        intencoes: ["momento", "casa"],
      })
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      expect(m.telemetry.spans.find((s) => s.nome === "run")?.atributos).toMatchObject({
        "run.caminho": "acompanhante",
        "run.intencoes": "momento,casa",
        "run.passos": 1,
      })
    })
  })

  describe("comSpanDoRun", () => {
    it("com executarRun dentro, gera um span run com os atributos finais", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.svc.iniciarRun(m.conta.id, {
        caminho: "acompanhante",
        intencoes: ["momento", "casa"],
      })
      await m.svc.comSpanDoRun(m.conta.id, run.id, () =>
        m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() }),
      )
      const raizes = m.telemetry.spans.filter((s) => s.nome === "run")
      expect(raizes).toHaveLength(1)
      expect(raizes[0]?.atributos).toMatchObject({
        "prompt.versao": "v1",
        "run.caminho": "acompanhante",
        "run.status": "running",
        "run.intencoes": "momento,casa",
      })
      expect(m.telemetry.logs.filter((l) => l.codigo === "run_inicio")).toHaveLength(1)
      const salvo = await m.stores.runs.buscar(m.conta.id, run.id)
      expect(salvo?.prompt_versao).toBe("v1")
      expect(salvo?.trace_id).toBeTruthy()
    })

    it("span interprete aberto dentro é filho do run", async () => {
      const m = await montar([])
      const run = await m.iniciar()
      await m.svc.comSpanDoRun(m.conta.id, run.id, () =>
        m.telemetry.span("interprete", {}, async () => undefined),
      )
      const spans = m.telemetry.spans
      const iRun = spans.findIndex((s) => s.nome === "run")
      const filho = spans.find((s) => s.nome === "interprete")
      expect(filho?.pai).toBe(iRun)
    })

    it("erro no corpo sobe e tira o run do mapa", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.iniciar()
      await expect(
        m.svc.comSpanDoRun(m.conta.id, run.id, async () => {
          throw new Error("falhou")
        }),
      ).rejects.toThrow("falhou")
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      expect(m.telemetry.spans.filter((s) => s.nome === "run")).toHaveLength(2)
    })

    it("sem comSpanDoRun, executarRun abre o seu span", async () => {
      const m = await montar([{ chamadas: [fin] }])
      const run = await m.iniciar()
      await m.svc.executarRun(m.conta.id, run.id, { ...m.exec, estado: estadoInicial() })
      const raizes = m.telemetry.spans.filter((s) => s.nome === "run")
      expect(raizes).toHaveLength(1)
      expect(raizes[0]?.atributos["prompt.versao"]).toBe("v1")
    })
  })
})
