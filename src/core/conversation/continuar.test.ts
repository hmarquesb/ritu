import { describe, expect, it } from "vitest"
import { createCompanion } from "@/core/agents/companion/responder"
import { createInterpreter } from "@/core/agents/interpreter/interpretar"
import type { Judge } from "@/core/agents/judge/julgar"
import { createMemoryAgent } from "@/core/agents/memory/memoria"
import { RituError } from "@/core/errors"
import { createModelRouter } from "@/core/llm/router"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import type { RespostaDaPessoa } from "@/core/runs/pergunta"
import { createRunService } from "@/core/runs/run-service"
import { createApprovingJudge, createScriptedJudge } from "@/infra/fakes/fake-judge"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createConversation } from "./conversar"

const kb = createMiniKnowledge()
const MIN = 60_000

const base = {
  intencoes: ["momento"],
  estados: ["com_frio", "agitada"],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}
const entregaOk = {
  resposta: "Respire devagar por um minuto.",
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
  sugestoes: [],
  evitar: [],
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}
const askCasa: PassoRoteirizado = {
  chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["abobora", "cenoura"] } }],
}
const askCome: PassoRoteirizado = {
  chamadas: [{ nome: "ask_user", argumentos: { tipo: "come", alimento: "ghee" } }],
}
const fim = (e: unknown = entregaOk): PassoRoteirizado => ({
  chamadas: [{ nome: "finalizar", argumentos: e }],
})
const tenhoNaoTenho: RespostaDaPessoa = {
  tipo: "casa",
  itens: [
    { alimento_id: "abobora", resposta: "tenho" },
    { alimento_id: "cenoura", resposta: "nao_tenho" },
  ],
}

async function montar(o: { llm?: unknown[]; roteiro: PassoRoteirizado[]; judge?: Judge }) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(o.roteiro, clock)
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const outra = await stores.accounts.criar({ tipo: "demo" })
  const router = createModelRouter({ ledger: createMemoryLedger(clock), clock, telemetry })
  const runs = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const interpreter = createInterpreter({
    router,
    client: createFakeLlm(o.llm ?? [base]),
    kb,
    telemetry,
    clock,
  })
  const decisao = { ligada: true }
  const routerDaDecisao = {
    ...router,
    paraPapel: router.paraPapel,
    temModelo: async (papel: Parameters<typeof router.temModelo>[0]) =>
      papel === "decisao" ? decisao.ligada && router.temModelo(papel) : router.temModelo(papel),
  } as typeof router
  const companion = createCompanion({
    stores,
    tx: stores,
    kb,
    clock,
    weather: createFakeWeather(),
    router: routerDaDecisao,
    runs,
    telemetry,
    judge: o.judge ?? createApprovingJudge(),
  })
  const memory = createMemoryAgent({ router, client: createFakeLlm([]), kb, telemetry, clock })
  const deps = { memory, stores, tx: stores, kb, clock, telemetry, runs, interpreter, companion }
  const conversation = createConversation(deps)
  return { clock, stores, telemetry, runtime, conta, outra, conversation, deps, decisao }
}
type M = Awaited<ReturnType<typeof montar>>

async function prepararCasa(m: M) {
  const velhos = [{ alimento_id: "abobora" }, { alimento_id: "cenoura" }]
  m.clock.set("2026-09-16T22:00:00.000Z")
  await m.stores.pantry.registrar(m.conta.id, velhos, "tela")
  m.clock.set("2026-11-15T22:00:00.000Z")
  await m.stores.pantry.registrar(m.conta.id, [{ alimento_id: "arroz-branco" }], "tela")
}

async function pausar(m: M) {
  await prepararCasa(m)
  const r = await m.conversation.conversar(m.conta.id, { texto: "o que como?", atalhos: [] })
  expect(r.status).toBe("waiting_for_input")
  return r
}

const continuar = (m: M, runId: string, r: RespostaDaPessoa) =>
  m.conversation.continuar(m.conta.id, runId, r)

async function falha(p: Promise<unknown>) {
  return p.catch((e: unknown) => e)
}

async function estado(m: M, runId: string) {
  const run = await m.stores.runs.buscar(m.conta.id, runId)
  if (!run) throw new Error("run ausente")
  return run
}

describe("continuar: pausa do agente", () => {
  it("grava Tenho e Não tenho, fecha o run e guarda as mensagens", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    const r = await continuar(m, p.run_id, tenhoNaoTenho)
    expect(r).toMatchObject({ status: "done", caminho: "acompanhante" })
    expect(r.saida?.resposta).toBe(entregaOk.resposta)
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.find((i) => i.alimento_id === "abobora")).toMatchObject({
      estado: "tem",
      origem: "pergunta",
    })
    expect(casa.find((i) => i.alimento_id === "cenoura")?.estado).toBe("acabou")
    const faltas = await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")
    // cenoura: "Não tenho"; ghee: o que teria entrado e não está em casa (a entrega grava).
    expect(faltas.map((f) => f.alimento_id).sort()).toEqual(["cenoura", "ghee"])
    const metricas = m.telemetry.metricas.filter((x) => x.nome === "ritu_faltas_total")
    expect(metricas.map((x) => x.rotulos.origem).sort()).toEqual(["nao_tenho", "teria_entrado"])
    const run = await estado(m, p.run_id)
    expect(run.status).toBe("done")
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens.map((x) => [x.autor, x.run_id])).toEqual([
      ["pessoa", p.run_id],
      ["agente", p.run_id],
      ["pessoa", p.run_id],
      ["agente", p.run_id],
    ])
    expect(mensagens[2]?.texto).toBe("Tenho: abóbora · Não tenho: cenoura")
    expect(mensagens[1]?.texto).toBe(p.pergunta?.texto)
    expect(mensagens[3]?.texto).toBe(entregaOk.resposta)
  })

  it("o que entrou em casa por Tenho na pausa não vira falta da entrega", async () => {
    const askGhee: PassoRoteirizado = {
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["ghee"] } }],
    }
    const m = await montar({ roteiro: [askGhee, fim()] })
    const p = await pausar(m)
    await continuar(m, p.run_id, {
      tipo: "casa",
      itens: [{ alimento_id: "ghee", resposta: "tenho" }],
    })
    expect(await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")).toEqual([])
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_faltas_total")).toHaveLength(0)
  })

  it("Não gosto grava o gosto e não mexe na casa", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    await continuar(m, p.run_id, {
      tipo: "casa",
      itens: [{ alimento_id: "abobora", resposta: "nao_gosto" }],
    })
    const prefs = await m.stores.preferences.ler(m.conta.id)
    expect(prefs.find((x) => x.item_id === "abobora")?.gosto).toBe("nao_gosta")
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.find((i) => i.alimento_id === "abobora")?.origem).toBe("tela")
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_gosto_total")).toHaveLength(1)
  })

  it("Pular e item sem resposta não gravam nada", async () => {
    const m = await montar({ roteiro: [askCasa, fim(), askCasa, fim()] })
    const p = await pausar(m)
    const r = await continuar(m, p.run_id, { tipo: "pular" })
    expect(r.status).toBe("done")
    // Só a falta da entrega (o que teria entrado); a pergunta pulada não grava "Não tenho".
    const faltas = await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")
    expect(faltas.map((f) => f.alimento_id)).toEqual(["ghee"])
    expect(await m.stores.preferences.ler(m.conta.id)).toEqual([])
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.every((i) => i.origem !== "pergunta")).toBe(true)
    expect(JSON.stringify(m.runtime.pedidos.at(-1))).toContain("pulou")
  })

  it("Não como: fica no checkpoint e na anotação, não no perfil", async () => {
    const m = await montar({ roteiro: [askCome, fim()] })
    const p = await pausar(m)
    const r = await continuar(m, p.run_id, { tipo: "come", resposta: "nao_como" })
    expect(r.status).toBe("waiting_for_approval")
    const run = await estado(m, p.run_id)
    expect(run.status).toBe("waiting_for_approval")
    expect(run.pendencia).toMatchObject({ tipo: "aprovacao" })
    const linhas = await m.stores.proposals.doRun(m.conta.id, p.run_id)
    expect(linhas.map((l) => l.tool)).toEqual(["memoria.propor"])
    expect(r.saida?.propostas).toHaveLength(1)
    const dados = (run.checkpoint as { dados: { nao_come_do_run: string[] } }).dados
    expect(dados.nao_come_do_run).toEqual(["ghee"])
    expect(r.saida?.anotacoes).toContainEqual({
      tipo: "nao_come",
      itens: [{ alimento_id: "ghee", nome: "Ghee" }],
    })
    expect((await m.stores.profiles.ler(m.conta.id)).nao_come).toEqual([])
  })

  it("rastro: mesmo trace e totais do Intérprete preservados", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    const antes = await estado(m, p.run_id)
    await continuar(m, p.run_id, tenhoNaoTenho)
    const run = await estado(m, p.run_id)
    expect(run.trace_id).toBe(antes.trace_id)
    const interprete = (await m.stores.runs.etapas(m.conta.id, p.run_id)).find(
      (e) => e.tipo === "interprete",
    )
    expect(run.tokens_entrada).toBeGreaterThanOrEqual(interprete?.tokens_entrada ?? 0)
    expect(run.modelos).toMatchObject({
      apoio: expect.any(Array),
      decisao: expect.any(Array),
    })
    expect(m.telemetry.spans.filter((s) => s.nome === "run").length).toBeGreaterThanOrEqual(2)
  })
})

describe("continuar: totais do run", () => {
  it("com modelo: loop + Intérprete, uma vez", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    await continuar(m, p.run_id, tenhoNaoTenho)
    const run = await estado(m, p.run_id)
    expect([run.tokens_entrada, run.tokens_saida]).toEqual([10 + 200, 5 + 40])
  })

  it("com o Juiz: tentativa 1, juiz_aprovado no run, apoio com Intérprete e Juiz, tokens somados", async () => {
    const judge = createScriptedJudge([
      {
        ok: true,
        aprovado: true,
        graves: [],
        registros: [],
        saude_na_proposta: false,
        apontamentos: [],
        modelo: "modelo-do-juiz",
        tokens: { entrada: 7, saida: 3 },
        trocas: 0,
        duracao_ms: 5,
      },
    ])
    const m = await montar({ roteiro: [askCasa, fim()], judge })
    const p = await pausar(m)
    await continuar(m, p.run_id, tenhoNaoTenho)
    const run = await estado(m, p.run_id)
    expect(judge.pedidos.map((x) => x.tentativa)).toEqual([1])
    expect(run).toMatchObject({ juiz_tentativas: 1, juiz_aprovado: true })
    expect((run.modelos as { apoio: string[] }).apoio).toHaveLength(2)
    expect((run.modelos as { apoio: string[] }).apoio).toContain("modelo-do-juiz")
    expect([run.tokens_entrada, run.tokens_saida]).toEqual([10 + 200 + 7, 5 + 40 + 3])
  })

  it("sem modelo de decisão na retomada: loop + Intérprete, uma vez", async () => {
    const m = await montar({ roteiro: [askCasa] })
    const p = await pausar(m)
    m.decisao.ligada = false
    const r = await continuar(m, p.run_id, tenhoNaoTenho)
    expect(r.status).toBe("done")
    const run = await estado(m, p.run_id)
    expect([run.tokens_entrada, run.tokens_saida]).toEqual([10 + 100, 5 + 20])
  })
})

describe("continuar: pausa de código", () => {
  const dor = (variante?: string) => ({
    ...base,
    incomodo: { id: "dor-de-cabeca", ...(variante ? { variante } : {}) },
  })

  it("variante: segue para o Acompanhante com a variante dita", async () => {
    const m = await montar({ llm: [dor()], roteiro: [fim()] })
    const p = await m.conversation.conversar(m.conta.id, { texto: "dor", atalhos: [] })
    expect(p.pergunta?.tipo).toBe("variante")
    const r = await continuar(m, p.run_id, { tipo: "variante", variante: "latejante" })
    expect(r.status).toBe("done")
    expect(JSON.stringify(m.runtime.pedidos[0])).toContain("latejante")
    const run = await estado(m, p.run_id)
    const mensagens = await m.stores.messages.doDia(m.conta.id, run.dia)
    expect(mensagens[2]).toMatchObject({ autor: "pessoa", com_incomodo: true })
    expect(mensagens[3]).toMatchObject({ autor: "agente", run_id: p.run_id })
  })

  it("Pular: roda sem variante", async () => {
    const m = await montar({ llm: [dor()], roteiro: [fim()] })
    const p = await m.conversation.conversar(m.conta.id, { texto: "dor", atalhos: [] })
    const r = await continuar(m, p.run_id, { tipo: "pular" })
    expect(r.status).toBe("done")
    const pedido = JSON.stringify(m.runtime.pedidos[0])
    expect(pedido).toContain("precisa_variante")
    expect(pedido).not.toMatch(/variante\\?":\\?"latejante/)
  })
})

describe("continuar: recusas", () => {
  it("30 min exatos valem; 30 min e 1 ms expiram sem gravar", async () => {
    const m = await montar({ roteiro: [askCasa, fim(), askCasa] })
    const p = await pausar(m)
    m.clock.advance(30 * MIN)
    expect((await continuar(m, p.run_id, { tipo: "pular" })).status).toBe("done")

    const m2 = await montar({ roteiro: [askCasa] })
    const p2 = await pausar(m2)
    m2.clock.advance(30 * MIN + 1)
    const e = await falha(continuar(m2, p2.run_id, tenhoNaoTenho))
    expect(e).toBeInstanceOf(RituError)
    expect((e as RituError).code).toBe("pergunta_expirada")
    expect((await estado(m2, p2.run_id)).status).toBe("expired")
    expect(await m2.stores.shortages.diasComFalta(m2.conta.id, "2000-01-01")).toEqual([])
    const run = await estado(m2, p2.run_id)
    expect(await m2.stores.messages.doDia(m2.conta.id, run.dia)).toHaveLength(2)
  })

  it("resposta que não combina: resposta_invalida e nada gravado", async () => {
    const m = await montar({ roteiro: [askCasa] })
    const p = await pausar(m)
    const invalidas: RespostaDaPessoa[] = [
      { tipo: "come", resposta: "como" },
      { tipo: "casa", itens: [{ alimento_id: "arroz-branco", resposta: "tenho" }] },
      { tipo: "variante", variante: "x" },
    ]
    for (const r of invalidas) {
      const e = await falha(continuar(m, p.run_id, r))
      expect((e as RituError).code).toBe("resposta_invalida")
    }
    expect((await estado(m, p.run_id)).status).toBe("waiting_for_input")
    expect(await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")).toEqual([])
    const run = await estado(m, p.run_id)
    expect(await m.stores.messages.doDia(m.conta.id, run.dia)).toHaveLength(2)
  })

  it("run done, cancelled ou de outra conta: RunNaoContinuavelError", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    const outra = await falha(m.conversation.continuar(m.outra.id, p.run_id, { tipo: "pular" }))
    expect(outra).toBeInstanceOf(RunNaoContinuavelError)
    expect((await estado(m, p.run_id)).status).toBe("waiting_for_input")
    await continuar(m, p.run_id, { tipo: "pular" })
    expect(await falha(continuar(m, p.run_id, { tipo: "pular" }))).toBeInstanceOf(
      RunNaoContinuavelError,
    )
    const m2 = await montar({ roteiro: [askCasa, fim()] })
    const p2 = await pausar(m2)
    await m2.stores.runs.atualizar(m2.conta.id, p2.run_id, { status: "cancelled" })
    expect(await falha(continuar(m2, p2.run_id, { tipo: "pular" }))).toBeInstanceOf(
      RunNaoContinuavelError,
    )
    expect((await estado(m2, p2.run_id)).status).toBe("cancelled")
  })

  it("duas chamadas ao mesmo tempo: a segunda falha e a casa grava uma vez", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await pausar(m)
    const [a, b] = await Promise.all([
      falha(continuar(m, p.run_id, tenhoNaoTenho)),
      falha(continuar(m, p.run_id, tenhoNaoTenho)),
    ])
    const erros = [a, b].filter((x) => x instanceof RunNaoContinuavelError)
    expect(erros).toHaveLength(1)
    const medidas = m.telemetry.metricas.filter((x) => x.nome === "ritu_faltas_total")
    expect(medidas.map((x) => x.rotulos.origem).sort()).toEqual(["nao_tenho", "teria_entrado"])
    const faltas = await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")
    expect(faltas.map((f) => f.alimento_id).sort()).toEqual(["cenoura", "ghee"])
  })

  it("falha em gravarResposta: o erro sobe e o run volta a waiting_for_input", async () => {
    const m = await montar({ roteiro: [askCasa] })
    const p = await pausar(m)
    const quebrado = {
      ...m.stores,
      emTransacao: async () => {
        throw new Error("falha simulada")
      },
    }
    const conversation = createConversation({ ...m.deps, tx: quebrado })
    const e = await falha(conversation.continuar(m.conta.id, p.run_id, tenhoNaoTenho))
    expect((e as Error).message).toBe("falha simulada")
    expect((await estado(m, p.run_id)).status).toBe("waiting_for_input")
  })

  it("erro na retomada: saída segura, run failed e resposta_segura com motivo erro_na_retomada", async () => {
    const m = await montar({ roteiro: [askCasa] })
    const p = await pausar(m)
    const companion = {
      ...m.deps.companion,
      continuar: async () => {
        throw new Error("falha simulada")
      },
    } as unknown as typeof m.deps.companion
    const conversation = createConversation({ ...m.deps, companion })
    const r = await conversation.continuar(m.conta.id, p.run_id, tenhoNaoTenho)
    expect(r).toMatchObject({ status: "failed" })
    expect(r.saida?.origem).toBe("segura")
    const logs = m.telemetry.logs.filter((l) => l.codigo === "resposta_segura")
    expect(logs.map((l) => l.campos.motivo)).toEqual(["erro_na_retomada"])
    expect(logs[0]?.nivel).toBe("warn")
  })

  it("mensagem nova cancela o run com pergunta aberta e mantém o respondido antes", async () => {
    const m = await montar({ roteiro: [askCasa, fim(), askCasa, fim()] })
    const p = await pausar(m)
    await m.stores.pantry.registrar(m.conta.id, [{ alimento_id: "ghee" }], "pergunta")
    await m.conversation.conversar(m.conta.id, { texto: "outra coisa", atalhos: [] })
    expect((await estado(m, p.run_id)).status).toBe("cancelled")
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.find((i) => i.alimento_id === "ghee")?.origem).toBe("pergunta")
  })
})

describe("continuar: limite de perguntas", () => {
  it("a 3ª pergunta do run é recusada e o loop segue", async () => {
    const dorLatejante = { ...base, incomodo: { id: "dor-de-cabeca" } }
    const askGhee: PassoRoteirizado = {
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "come", alimento: "ghee" } }],
    }
    const m = await montar({
      llm: [dorLatejante],
      roteiro: [askCasa, askGhee, fim()],
    })
    await prepararCasa(m)
    const p = await m.conversation.conversar(m.conta.id, { texto: "dor", atalhos: [] })
    const a = await continuar(m, p.run_id, { tipo: "variante", variante: "latejante" })
    expect(a.status).toBe("waiting_for_input")
    const b = await continuar(m, p.run_id, { tipo: "pular" })
    expect(b.status).toBe("done")
    const recusadas = (await m.stores.runs.etapas(m.conta.id, p.run_id)).filter(
      (e) => e.status === "recusado",
    )
    expect(recusadas.length).toBeGreaterThan(0)
  })
})

describe("continuar: padrão candidato no fim do run", () => {
  it("depois da pergunta, o run termina com o padrão como linha do bloco", async () => {
    const m = await montar({ roteiro: [askCasa, fim()] })
    const p = await m.stores.patterns.propor(m.conta.id, {
      tipo: "ajuda_em_estado",
      chave: "com_frio+agitada|pratica:cha-gengibre",
      frase: "Quando você está com frio e agitada, chá de gengibre costuma te ajudar.",
      ocorrencias: 3,
    })
    const pausado = await pausar(m)
    const r = await continuar(m, pausado.run_id, tenhoNaoTenho)
    expect(r.status).toBe("waiting_for_approval")
    const linhas = await m.stores.proposals.doRun(m.conta.id, pausado.run_id)
    expect(linhas.map((l) => l.tool)).toContain("padrao.confirmar")
    expect(linhas.at(-1)?.conteudo).toMatchObject({ padrao_id: p?.id })
  })
})
