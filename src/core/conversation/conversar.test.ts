import { llmCotas } from "@config/index"
import { describe, expect, it, vi } from "vitest"
import { createCompanion } from "@/core/agents/companion/responder"
import { createInterpreter } from "@/core/agents/interpreter/interpretar"
import { executarLimpeza } from "@/core/cleanup"
import { RituError } from "@/core/errors"
import { resolverEvitar } from "@/core/knowledge/identificar"
import { createModelRouter } from "@/core/llm/router"
import { RunAbertoError } from "@/core/runs/errors"
import { createRunService } from "@/core/runs/run-service"
import { diaLocal } from "@/core/time/dia-local"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createConversation } from "./conversar"
import { textosDaConversa } from "./textos"

const kb = createMiniKnowledge()
const SEGREDO = "texto-secreto-da-pessoa"

const base = {
  intencoes: ["vida"],
  estados: [],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}
const saida = (parcial: Record<string, unknown>) => ({ ...base, ...parcial })

const entregaOk = {
  resposta: "Respire devagar por um minuto.",
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
}
const entregaDoMomento = {
  ...entregaOk,
  incertos: ["Não sei o que há na sua casa."],
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
}
const finalizar = (argumentos: unknown = entregaOk): PassoRoteirizado => ({
  chamadas: [{ nome: "finalizar", argumentos }],
})

const semVagaNoApoio = {
  ...llmCotas,
  modelos: { ...llmCotas.modelos, "gemini-3.5-flash-lite": { rpm: 1, tpm: 1, rpd: 0 } },
  papeis: { ...llmCotas.papeis, apoio: ["gemini-3.5-flash-lite"] },
} as unknown as typeof llmCotas

type Opcoes = {
  llm?: unknown[]
  roteiro?: PassoRoteirizado[]
  semApoio?: boolean
  companion?: ReturnType<typeof createCompanion>
}

async function montar(o: Opcoes = {}) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const ledger = createMemoryLedger(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(o.roteiro ?? [], clock)
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const fake = createFakeLlm(o.llm ?? [])
  const vistas: { texto: string; run_id: string | null }[][] = []
  const llm = {
    pedidos: fake.pedidos,
    async gerar(p: Parameters<typeof fake.gerar>[0]) {
      vistas.push(await stores.messages.doDia(conta.id, diaLocal(clock.now())))
      return fake.gerar(p)
    },
  } as typeof fake
  const router = createModelRouter({
    ledger: createMemoryLedger(clock),
    clock,
    telemetry,
    ...(o.semApoio ? { cotas: semVagaNoApoio } : {}),
  })
  const runs = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const interpreter = createInterpreter({ router, client: llm, kb, telemetry, clock })
  const companion =
    o.companion ??
    createCompanion({ stores, kb, clock, weather: createFakeWeather(), router, runs, telemetry })
  const conversation = createConversation({
    stores,
    tx: stores,
    kb,
    clock,
    telemetry,
    runs,
    interpreter,
    companion,
  })
  return { clock, stores, ledger, telemetry, runtime, llm, vistas, conta, conversation, runs }
}

type Montagem = Awaited<ReturnType<typeof montar>>

const dizer = (m: Montagem, texto: string, atalhos: never[] = []) =>
  m.conversation.conversar(m.conta.id, { texto, atalhos })

async function etapasDe(m: Montagem, runId: string) {
  return m.stores.runs.etapas(m.conta.id, runId)
}

async function runDe(m: Montagem, runId: string) {
  const run = await m.stores.runs.buscar(m.conta.id, runId)
  if (!run) throw new Error("run ausente")
  return run
}

async function criarRetorno(m: Montagem) {
  const run = await m.stores.runs.criar(m.conta.id, {
    caminho: "acompanhante",
    intencoes: [],
    dia: diaLocal(m.clock.now()),
  })
  await m.stores.runs.atualizar(m.conta.id, run.id, { status: "done" })
  await m.stores.outcomes.criar(m.conta.id, run.id, [
    {
      tipo: "cha",
      preparo_id: "cha-gengibre",
      alimentos: ["gengibre"],
      titulo: "Chá de gengibre",
    },
  ])
}

describe("conversar: caminhos sem agente", () => {
  const casos = [
    {
      caminho: "casa",
      llm: saida({ intencoes: ["casa"], itens_casa: [{ nome: "abóbora", acao: "tem" }] }),
      texto: /abóbora em casa/i,
    },
    {
      caminho: "ajuda",
      llm: saida({ intencoes: ["ajuda"] }),
      texto: textosDaConversa.ajuda,
    },
    {
      caminho: "ofensa",
      llm: saida({ intencoes: ["ofensa"] }),
      texto: textosDaConversa.ofensa,
    },
    {
      caminho: "fora",
      llm: saida({ intencoes: ["fora"] }),
      texto: textosDaConversa.fora,
    },
    {
      caminho: "evitar",
      llm: saida({ intencoes: ["evitar"], evitar_sempre: ["leite"] }),
      texto: /não sugiro/,
    },
    {
      caminho: "retorno",
      llm: saida({ intencoes: ["retorno"], retorno: { resultado: "ajudou", pendente: 1 } }),
      texto: /chá de gengibre ajudou/,
    },
  ] as const

  for (const caso of casos) {
    it(`${caso.caminho} termina com origem codigo e sem pedido ao runtime`, async () => {
      const m = await montar({ llm: [caso.llm] })
      if (caso.caminho === "retorno") await criarRetorno(m)
      const r = await dizer(m, "mensagem")
      const comBloco = caso.caminho === "casa" || caso.caminho === "evitar"
      expect(r).toMatchObject({
        status: comBloco ? "waiting_for_approval" : "done",
        caminho: caso.caminho,
      })
      expect(r.saida?.origem).toBe("codigo")
      expect(r.saida?.resposta).toMatch(caso.texto)
      expect(m.runtime.pedidos).toHaveLength(0)
      const run = await runDe(m, r.run_id)
      expect(run.status).toBe(comBloco ? "waiting_for_approval" : "done")
      expect(run.caminho).toBe(caso.caminho)
    })
  }
})

describe("conversar: atalhos e acompanhante", () => {
  it("só atalhos não chama o LlmClient e vai ao Acompanhante com momento", async () => {
    const m = await montar({ roteiro: [finalizar(entregaDoMomento)] })
    const r = await m.conversation.conversar(m.conta.id, { atalhos: ["com_frio"] })
    expect(m.llm.pedidos).toHaveLength(0)
    expect(r.caminho).toBe("acompanhante")
    expect(r.status).toBe("done")
    const run = await runDe(m, r.run_id)
    expect(run.intencoes).toEqual(["momento"])
    expect(run.momento?.estados).toEqual(["com_frio"])
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas.some((e) => e.tipo === "interprete")).toBe(false)
    const [pessoa] = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(pessoa?.texto).toContain("com frio")
  })

  it("casa + momento vão ao Acompanhante com as duas, sem gravar na casa", async () => {
    const m = await montar({
      llm: [
        saida({
          intencoes: ["casa", "momento"],
          itens_casa: [{ nome: "abóbora", acao: "tem" }],
        }),
      ],
      roteiro: [{ chamadas: [{ nome: "casa.ler", argumentos: {} }] }, finalizar()],
    })
    const r = await dizer(m, "comprei abóbora, o que faço com ela hoje?")
    expect(r.caminho).toBe("acompanhante")
    const run = await runDe(m, r.run_id)
    expect(run.intencoes).toEqual(["casa", "momento"])
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas.find((e) => e.tipo === "tool" && e.nome === "casa.ler")?.resumo).toBe(
      "1 confirmados, 0 incertos",
    )
    expect(await m.stores.pantry.listar(m.conta.id)).toEqual([])
    expect(r.saida?.anotacoes).toMatchObject([{ tipo: "casa_tem" }])
    expect(run.saida).toMatchObject({ anotacoes: [{ tipo: "casa_tem" }] })
  })

  it("com retorno ligado e Acompanhante: registra antes e grava o evitar do dia", async () => {
    const m = await montar({
      llm: [
        saida({
          intencoes: ["retorno", "pergunta"],
          retorno: { resultado: "ajudou", pendente: 1 },
          evitar_sempre: ["leite"],
        }),
      ],
      roteiro: [finalizar()],
    })
    await criarRetorno(m)
    const r = await dizer(m, "o chá ajudou, e o que como agora? sem leite")
    expect(r.caminho).toBe("acompanhante")
    const pendentes = await m.stores.outcomes.pendentes(m.conta.id)
    expect(pendentes).toHaveLength(0)
    const dia = (await runDe(m, r.run_id)).dia
    expect(await m.stores.profiles.evitarTemporario(m.conta.id, dia)).toEqual([
      resolverEvitar("leite", kb),
    ])
  })
})

describe("conversar: alertas", () => {
  for (const alerta of ["fisico", "emocional"] as const) {
    it(`alerta ${alerta}: texto fixo, sem anotação, mensagens com incômodo e apagadas no dia seguinte`, async () => {
      const m = await montar({
        llm: [saida({ intencoes: ["momento"], alerta, evitar_sempre: ["leite"] })],
      })
      const r = await dizer(m, "mensagem de alerta")
      expect(r.caminho).toBe("alerta")
      expect(r.saida?.resposta).toBe(
        alerta === "fisico" ? textosDaConversa.alertaFisico : textosDaConversa.alertaEmocional,
      )
      expect(r.saida?.anotacoes).toEqual([])
      const run = await runDe(m, r.run_id)
      expect(run.intencoes).toEqual(["alerta"])
      expect(run.com_incomodo).toBe(true)
      expect(await m.stores.profiles.evitarTemporario(m.conta.id, run.dia)).toEqual([])
      const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
      expect(mensagens.map((x) => x.com_incomodo)).toEqual([true, true])
      const etapas = await etapasDe(m, r.run_id)
      expect(etapas.find((e) => e.tipo === "guardrail")).toMatchObject({
        nome: alerta === "fisico" ? "alerta_fisico" : "alerta_emocional",
        status: "recusado",
      })
      m.clock.advance(24 * 60 * 60 * 1000)
      await executarLimpeza({ stores: m.stores, clock: m.clock, ledger: m.ledger })
      expect(await m.stores.messages.doDia(m.conta.id, run.dia)).toEqual([])
    })
  }
})

describe("conversar: retorno", () => {
  it("retorno ligado soma preferências e a métrica, com o título no texto", async () => {
    const m = await montar({
      llm: [saida({ intencoes: ["retorno"], retorno: { resultado: "ajudou", pendente: 1 } })],
    })
    await criarRetorno(m)
    const r = await dizer(m, "ajudou")
    expect(r.saida?.resposta).toContain("chá de gengibre")
    expect(await m.stores.outcomes.pendentes(m.conta.id)).toEqual([])
    const preferencias = await m.stores.preferences.ler(m.conta.id)
    expect(preferencias.find((p) => p.item_id === "gengibre")?.ajudou).toBe(1)
    const soma = m.telemetry.metricas.filter((x) => x.nome === "ritu_retorno_total")
    expect(soma).toHaveLength(1)
    expect(soma[0]?.rotulos).toMatchObject({ resultado: "ajudou", origem: "conversa" })
    const [retorno] = await m.stores.outcomes.doRun(
      m.conta.id,
      (await m.stores.runs.recentes(m.conta.id, new Date(0), 10))[0]?.id ?? "",
    )
    expect(retorno?.origem ?? "conversa").toBe("conversa")
  })

  for (const pendente of [undefined, 7]) {
    it(`sem ligação (pendente ${pendente}) nada muda e sai retornoSemLigacao`, async () => {
      const m = await montar({
        llm: [
          saida({
            intencoes: ["retorno"],
            retorno: { resultado: "ajudou", ...(pendente ? { pendente } : {}) },
          }),
        ],
      })
      if (pendente) await criarRetorno(m)
      const r = await dizer(m, "ajudou")
      expect(r.saida?.resposta).toBe(textosDaConversa.retornoSemLigacao)
      expect(await m.stores.preferences.ler(m.conta.id)).toEqual([])
      expect(m.telemetry.metricas.some((x) => x.nome === "ritu_retorno_total")).toBe(false)
      if (pendente) expect(await m.stores.outcomes.pendentes(m.conta.id)).toHaveLength(1)
    })
  }
})

describe("conversar: evitar", () => {
  it("grava no temporário do dia, anota evitar_sempre e não mexe no perfil", async () => {
    const m = await montar({ llm: [saida({ intencoes: ["evitar"], evitar_sempre: ["leite"] })] })
    const r = await dizer(m, "não posso comer leite")
    const item = resolverEvitar("leite", kb)
    const run = await runDe(m, r.run_id)
    expect(await m.stores.profiles.evitarTemporario(m.conta.id, run.dia)).toEqual([item])
    expect(r.saida?.anotacoes).toEqual([{ tipo: "evitar_sempre", itens: [item] }])
    expect((await m.stores.profiles.ler(m.conta.id)).evitar_sempre).toEqual([])
  })

  it("item já no perfil: sem anotação, evitarJaGuardado e temporário gravado mesmo assim", async () => {
    const m = await montar({ llm: [saida({ intencoes: ["evitar"], evitar_sempre: ["leite"] })] })
    const item = resolverEvitar("leite", kb)
    await m.stores.profiles.acrescentarEvitarSempre(m.conta.id, [item])
    const r = await dizer(m, "não posso comer leite")
    expect(r.saida?.anotacoes).toEqual([])
    expect(r.saida?.resposta).toContain("já está em Evitar sempre")
    const run = await runDe(m, r.run_id)
    expect(await m.stores.profiles.evitarTemporario(m.conta.id, run.dia)).toEqual([item])
  })

  it("restrição e não como (com id) entram no temporário do dia", async () => {
    const m = await montar({
      llm: [saida({ intencoes: ["evitar"], restricoes: ["vegetariana"], nao_come: ["banana"] })],
    })
    const r = await dizer(m, "sou vegetariana e não como banana")
    const run = await runDe(m, r.run_id)
    expect(await m.stores.profiles.evitarTemporario(m.conta.id, run.dia)).toEqual([
      { tipo: "nao_come", valor: "banana" },
      { tipo: "restricao", valor: "vegetariana" },
    ])
  })
})

describe("conversar: Intérprete indisponível", () => {
  it("sem modelo: caminho sem_modelo, etapa falhou e métrica de fallback", async () => {
    const m = await montar({ semApoio: true })
    const r = await m.conversation.conversar(m.conta.id, { texto: "oi", atalhos: ["com_frio"] })
    expect(r).toMatchObject({ status: "done", caminho: "sem_modelo" })
    expect(r.interpretacao).toBeUndefined()
    expect(m.llm.pedidos).toHaveLength(0)
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas.find((e) => e.tipo === "interprete")).toMatchObject({
      status: "falhou",
      resumo: "sem_modelo",
      modelo: null,
    })
    const fallbacks = m.telemetry.metricas.filter((x) => x.nome === "ritu_fallback_sem_llm_total")
    expect(fallbacks).toHaveLength(1)
  })

  it("erro do modelo: mesmo caminho, com o motivo na etapa", async () => {
    const erros = Array.from({ length: 6 }, () => ({ erro: "indisponivel" }))
    const m = await montar({ llm: erros })
    const r = await dizer(m, "oi")
    expect(r).toMatchObject({ status: "done", caminho: "sem_modelo" })
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas.find((e) => e.tipo === "interprete")).toMatchObject({ status: "falhou" })
    const mensagens = await m.stores.messages.doDia(m.conta.id, (await runDe(m, r.run_id)).dia)
    expect(mensagens.at(-1)?.autor).toBe("agente")
  })
})

describe("conversar: mensagens", () => {
  it("a da pessoa vem antes do pedido ao fake e a do agente ao fim", async () => {
    const m = await montar({ llm: [saida({ intencoes: ["ajuda"] })] })
    const r = await dizer(m, SEGREDO)
    expect(m.vistas[0]).toHaveLength(1)
    expect(m.vistas[0]?.[0]).toMatchObject({ run_id: r.run_id, texto: SEGREDO })
    const mensagens = await m.stores.messages.doDia(m.conta.id, (await runDe(m, r.run_id)).dia)
    expect(mensagens.map((x) => x.autor)).toEqual(["pessoa", "agente"])
    expect(mensagens[1]?.texto).toBe(r.saida?.resposta)
  })

  it("erro inesperado: run failed, saída segura gravada e devolvida", async () => {
    const companion = {
      responder: async () => {
        throw new Error("falha inesperada")
      },
    } as unknown as ReturnType<typeof createCompanion>
    const m = await montar({ llm: [saida({})], companion })
    const r = await dizer(m, "oi")
    expect(r).toMatchObject({ status: "failed", caminho: "acompanhante" })
    expect(r.saida?.origem).toBe("segura")
    const run = await runDe(m, r.run_id)
    expect(run.status).toBe("failed")
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.map((x) => x.autor)).toEqual(["pessoa", "agente"])
    expect(mensagens[1]?.texto).toBe(r.saida?.resposta)
  })
})

describe("conversar: run e rastro", () => {
  it("primeira etapa interprete, totais do apoio, um só span run e sem texto da pessoa", async () => {
    const m = await montar({
      llm: [
        saida({
          intencoes: ["casa"],
          itens_casa: [{ nome: "abóbora", acao: "tem" }],
        }),
      ],
    })
    const r = await dizer(m, `${SEGREDO} abóbora`)
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas[0]).toMatchObject({
      tipo: "interprete",
      nome: "interprete",
      status: "ok",
      resumo: "casa",
      tokens_entrada: 10,
      tokens_saida: 5,
    })
    expect(etapas[0]?.modelo).toBe(llmCotas.papeis.apoio[0])
    const run = await runDe(m, r.run_id)
    expect(run.modelos).toEqual({ apoio: [llmCotas.papeis.apoio[0]] })
    expect(run.tokens_entrada).toBe(10)
    expect(run.tokens_saida).toBe(5)
    const runs = m.telemetry.spans.filter((s) => s.nome === "run")
    expect(runs).toHaveLength(1)
    const indiceDoRun = m.telemetry.spans.findIndex((s) => s.nome === "run")
    expect(m.telemetry.spans.find((s) => s.nome === "interprete")?.pai).toBe(indiceDoRun)
    const rastro = JSON.stringify([
      m.telemetry.spans,
      m.telemetry.metricas,
      m.telemetry.logs,
      etapas.map((e) => e.resumo),
    ])
    expect(rastro).not.toContain(SEGREDO)
    expect(rastro.toLowerCase()).not.toContain("bóbora")
    expect(rastro).not.toContain("abobora")
    const intencao = m.telemetry.metricas.filter((x) => x.nome === "ritu_run_intencao_total")
    expect(intencao.map((x) => x.rotulos.intencao)).toEqual(["casa"])
  })

  it("no Acompanhante o apoio é somado sem perder o modelo de decisão", async () => {
    const m = await montar({ llm: [saida({})], roteiro: [finalizar()] })
    const r = await dizer(m, "oi, tudo bem?")
    const run = await runDe(m, r.run_id)
    expect(run.modelos).toMatchObject({ apoio: [llmCotas.papeis.apoio[0]] })
    expect((run.modelos as { decisao: string[] }).decisao.length).toBeGreaterThan(0)
    expect(run.tokens_entrada).toBeGreaterThan(10)
    expect(m.telemetry.spans.filter((s) => s.nome === "run")).toHaveLength(1)
  })

  it("run aberto lança RunAbertoError antes de qualquer pedido ao fake", async () => {
    const m = await montar({ llm: [saida({})] })
    await m.stores.runs.criar(m.conta.id, {
      caminho: "acompanhante",
      intencoes: [],
      dia: diaLocal(m.clock.now()),
    })
    await expect(dizer(m, "oi")).rejects.toBeInstanceOf(RunAbertoError)
    expect(m.llm.pedidos).toHaveLength(0)
  })
})

describe("conversar: entrada inválida", () => {
  const invalidas = [
    ["sem texto e sem atalhos", { atalhos: [] }],
    ["só espaços", { texto: "   ", atalhos: [] }],
    ["1001 caracteres", { texto: "a".repeat(1001), atalhos: [] }],
    ["atalho inexistente", { atalhos: ["inexistente"] }],
  ] as const

  for (const [nome, mensagem] of invalidas) {
    it(`${nome} lança mensagem_invalida sem criar run`, async () => {
      const m = await montar()
      const falha = await m.conversation
        .conversar(m.conta.id, mensagem as unknown as { atalhos: [] })
        .catch((e: unknown) => e)
      expect(falha).toBeInstanceOf(RituError)
      expect((falha as RituError).code).toBe("mensagem_invalida")
      expect(await m.stores.runs.aberto(m.conta.id)).toBeUndefined()
      expect(m.llm.pedidos).toHaveLength(0)
    })
  }
})

describe("conversar: pausas", () => {
  const dorDeCabeca = (incomodo: Record<string, unknown>) =>
    saida({ intencoes: ["momento"], incomodo })

  it("variante do incômodo pausa por código, sem Acompanhante nem decisão", async () => {
    const m = await montar({ llm: [dorDeCabeca({ id: "dor-de-cabeca" })] })
    const r = await dizer(m, SEGREDO)
    expect(r).toMatchObject({ status: "waiting_for_input", caminho: "acompanhante" })
    expect(r.saida).toBeUndefined()
    expect(r.pergunta).toMatchObject({ tipo: "variante", incomodo: "dor-de-cabeca" })
    expect(r.pergunta?.tipo === "variante" && r.pergunta.opcoes).toHaveLength(3)
    expect(m.runtime.pedidos).toHaveLength(0)
    expect(m.llm.pedidos).toHaveLength(1)
    const run = await runDe(m, r.run_id)
    expect(run.status).toBe("waiting_for_input")
    expect(run.checkpoint).toBeNull()
    expect(run.com_incomodo).toBe(true)
    expect(run.pendencia).toMatchObject({
      tipo: "pergunta",
      conteudo: { origem: "codigo", pergunta: r.pergunta, anotacoes: [] },
    })
    expect(run.modelos).toMatchObject({ apoio: expect.any(Array) })
    const etapas = await etapasDe(m, r.run_id)
    expect(etapas.find((e) => e.tipo === "pergunta")).toMatchObject({
      nome: "variante",
      resumo: "variante",
      status: "ok",
    })
    expect(m.telemetry.eventos.filter((e) => e.nome === "pausa")).toHaveLength(1)
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_pausas_total")).toHaveLength(1)
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.map((x) => x.com_incomodo)).toEqual([true, true])
    expect(mensagens.every((x) => x.run_id === r.run_id)).toBe(true)
    expect(mensagens[1]?.texto).toBe(r.pergunta?.texto)
    const rastro = JSON.stringify([
      m.telemetry.spans,
      m.telemetry.metricas,
      m.telemetry.eventos,
      m.telemetry.logs,
      etapas.map((e) => e.resumo),
    ])
    expect(rastro).not.toContain(SEGREDO)
    expect(rastro).not.toContain("dor-de-cabeca")
  })

  it("variante única ou já dita não pausa", async () => {
    const unica = await montar({
      llm: [dorDeCabeca({ id: "gases" })],
      roteiro: [finalizar(entregaDoMomento)],
    })
    expect((await dizer(unica, "gases")).status).toBe("done")
    const dita = await montar({
      llm: [dorDeCabeca({ id: "dor-de-cabeca", variante: "latejante" })],
      roteiro: [
        finalizar({
          ...entregaDoMomento,
          explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["frio"] },
        }),
      ],
    })
    expect((await dizer(dita, "latejante")).status).toBe("done")
  })

  it("pergunta do agente: devolve a pergunta, grava a mensagem e a anotação", async () => {
    const m = await montar({
      llm: [saida({ intencoes: ["momento"], estados: ["com_frio", "agitada"] })],
      roteiro: [
        { chamadas: [{ nome: "casa.ler", argumentos: {} }] },
        {
          chamadas: [
            { nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["abobora", "cenoura"] } },
          ],
        },
      ],
    })
    m.clock.set("2026-09-16T22:00:00.000Z")
    const velhos = [{ alimento_id: "abobora" }, { alimento_id: "cenoura" }]
    await m.stores.pantry.registrar(m.conta.id, velhos, "tela")
    m.clock.set("2026-11-15T22:00:00.000Z")
    const novos = [{ alimento_id: "arroz-branco" }, { alimento_id: "ghee" }]
    await m.stores.pantry.registrar(m.conta.id, novos, "tela")
    const r = await dizer(m, "o que como?")
    expect(r).toMatchObject({ status: "waiting_for_input", caminho: "acompanhante" })
    expect(r.saida).toBeUndefined()
    expect(r.pergunta?.tipo).toBe("casa")
    const run = await runDe(m, r.run_id)
    expect(run.saida).toBeNull()
    expect(run.pendencia).toMatchObject({
      conteudo: { origem: "agente", anotacoes: expect.any(Array) },
    })
    expect(run.modelos).toMatchObject({ apoio: expect.any(Array) })
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.map((x) => x.autor)).toEqual(["pessoa", "agente"])
    expect(mensagens[1]).toMatchObject({ texto: r.pergunta?.texto, com_incomodo: false })
  })
})

describe("conversar: fim do run com o bloco de aprovação", () => {
  const casaDaFeira = saida({
    intencoes: ["casa"],
    itens_casa: [
      { nome: "abóbora", acao: "tem" },
      { nome: "couve", acao: "tem" },
      { nome: "pitaia", acao: "tem" },
    ],
  })

  it("caminho casa: uma linha pendente, etapa, pendência, pausa e resposta gravada", async () => {
    const m = await montar({ llm: [casaDaFeira] })
    const r = await dizer(m, "fui à feira")
    expect(r.status).toBe("waiting_for_approval")
    const run = await runDe(m, r.run_id)
    expect(run.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, r.run_id)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ tool: "casa.propor", decisao: "pendente" })
    expect(r.saida?.propostas).toEqual([
      {
        id: linhas[0]?.id,
        tool: "casa.propor",
        texto: "Você tem abóbora, couve e pitaia em casa",
      },
    ])
    expect(run.pendencia).toMatchObject({
      tipo: "aprovacao",
      conteudo: { propostas: [linhas[0]?.id] },
    })
    const etapas = await etapasDe(m, r.run_id)
    const propostas = etapas.filter((e) => e.tipo === "proposta")
    expect(propostas.map((e) => [e.nome, e.resumo])).toEqual([["casa.propor", "casa: 3 itens"]])
    const pausas = m.telemetry.eventos.filter((e) => e.nome === "pausa")
    expect(pausas).toHaveLength(1)
    expect(m.telemetry.metricas.find((x) => x.nome === "ritu_pausas_total")?.rotulos).toMatchObject(
      { tipo: "aprovacao" },
    )
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.at(-1)?.texto).toBe(r.saida?.resposta)
    expect(run.saida).toMatchObject({ resposta: r.saida?.resposta })
  })

  it("nada é gravado antes da aprovação e nenhum rastro leva nome ou texto", async () => {
    const m = await montar({ llm: [casaDaFeira] })
    const antes = JSON.stringify([
      await m.stores.profiles.ler(m.conta.id),
      await m.stores.pantry.listar(m.conta.id),
      await m.stores.routine.notasAtivas(m.conta.id),
      await m.stores.shortages.lista(m.conta.id),
    ])
    const r = await dizer(m, SEGREDO)
    const depois = JSON.stringify([
      await m.stores.profiles.ler(m.conta.id),
      await m.stores.pantry.listar(m.conta.id),
      await m.stores.routine.notasAtivas(m.conta.id),
      await m.stores.shortages.lista(m.conta.id),
    ])
    expect(depois).toBe(antes)
    const etapas = await etapasDe(m, r.run_id)
    const rastro = JSON.stringify([
      etapas.map((e) => e.resumo),
      m.telemetry.spans,
      m.telemetry.metricas,
      m.telemetry.logs,
    ])
    for (const proibido of ["abóbora", "couve", "pitaia", SEGREDO]) {
      expect(rastro).not.toContain(proibido)
    }
  })

  it("nota de rotina do agente vira linha de rotina e a saída não leva propostas_do_agente", async () => {
    const m = await montar({
      llm: [saida({ intencoes: ["vida"], fato_de_rotina: "acordo cedo" })],
      roteiro: [
        { chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }] },
        finalizar(),
      ],
    })
    const r = await dizer(m, "acordo cedo")
    expect(r.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, r.run_id)
    expect(linhas.map((l) => l.conteudo)).toEqual([{ tipo: "rotina", texto: "acordo cedo" }])
    expect(r.saida && "propostas_do_agente" in r.saida).toBe(false)
    const run = await runDe(m, r.run_id)
    expect(run.saida && "propostas_do_agente" in (run.saida as object)).toBe(false)
  })

  it("sem nada a propor termina em done com propostas vazias", async () => {
    const m = await montar({ llm: [saida({ intencoes: ["vida"] })], roteiro: [finalizar()] })
    const r = await dizer(m, "oi")
    expect(r.status).toBe("done")
    expect(r.saida?.propostas).toEqual([])
    expect(await m.stores.proposals.doRun(m.conta.id, r.run_id)).toEqual([])
  })

  it("com incômodo e anotação de casa, nenhuma proposta e done", async () => {
    const m = await montar({
      llm: [
        saida({
          intencoes: ["momento"],
          incomodo: { id: "dor-de-cabeca", variante: "latejante" },
          itens_casa: [{ nome: "abóbora", acao: "tem" }],
        }),
      ],
      roteiro: [
        finalizar({
          ...entregaDoMomento,
          explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["frio"] },
        }),
      ],
    })
    const r = await dizer(m, "dor de cabeça")
    expect(r.status).toBe("done")
    expect(await m.stores.proposals.doRun(m.conta.id, r.run_id)).toEqual([])
  })

  it("alerta não propõe nada", async () => {
    const m = await montar({
      llm: [
        saida({
          intencoes: ["momento"],
          alerta: "fisico",
          itens_casa: [{ nome: "abóbora", acao: "tem" }],
        }),
      ],
    })
    const r = await dizer(m, "alerta")
    expect(r.status).toBe("done")
    expect(r.saida?.propostas).toEqual([])
  })

  it("falha ao criar as propostas: run failed, mensagem do agente gravada, saída sem propostas", async () => {
    const m = await montar({ llm: [casaDaFeira] })
    vi.spyOn(m.stores.proposals, "criar").mockRejectedValue(new Error("banco fora"))
    const r = await dizer(m, "fui à feira")
    expect(r.status).toBe("failed")
    expect(r.saida?.propostas).toEqual([])
    const run = await runDe(m, r.run_id)
    expect(run.saida).toEqual(r.saida)
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.at(-1)).toMatchObject({ autor: "agente", texto: r.saida?.resposta })
  })
})
