import { llmCotas } from "@config/index"
import { describe, expect, it } from "vitest"
import { createModelRouter, type ModelRouter } from "@/core/llm/router"
import type { RunEtapa } from "@/core/runs/ports"
import { createRunService } from "@/core/runs/run-service"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import type { EntradaDoAcompanhante } from "./entrada"
import { createCompanion } from "./responder"

const kb = createMiniKnowledge()
const TEXTO_DA_PESSOA = "texto secreto da pessoa"

const entregaOk = {
  resposta: "Respire devagar por um minuto.",
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
}
const entregaRuim = {
  ...entregaOk,
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: ["quente"] },
}
const entregaDoMomento = {
  ...entregaOk,
  incertos: ["Não sei o que há na sua casa."],
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
}
const finalizar = (argumentos: unknown): PassoRoteirizado => ({
  chamadas: [{ nome: "finalizar", argumentos }],
})
const entrada = (e: Partial<EntradaDoAcompanhante> = {}): EntradaDoAcompanhante => ({
  intencoes: ["pergunta"],
  estados: [],
  evitar_da_mensagem: [],
  ...e,
})

const semVaga = {
  ...llmCotas,
  modelos: { ...llmCotas.modelos, "gemini-3.5-flash-lite": { rpm: 1, tpm: 1, rpd: 0 } },
  papeis: { ...llmCotas.papeis, decisao: ["gemini-3.5-flash-lite"] },
} as unknown as typeof llmCotas

async function montar(roteiro: PassoRoteirizado[], opts: { semModelo?: boolean } = {}) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(roteiro, clock)
  const weather = createFakeWeather()
  const router = createModelRouter({
    ledger: createMemoryLedger(clock),
    clock,
    telemetry,
    ...(opts.semModelo ? { cotas: semVaga } : {}),
  })
  const runs = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const companion = (r: ModelRouter = router) =>
    createCompanion({ stores, kb, clock, weather, router: r, runs, telemetry })
  return { clock, stores, telemetry, weather, router, conta, companion }
}

const tipos = (etapas: RunEtapa[]) => etapas.map((e) => e.tipo)

describe("createCompanion.responder", () => {
  it("autocorreção: finalizar recusado e depois corrigido termina em done", async () => {
    const m = await montar([finalizar(entregaRuim), finalizar(entregaOk)])
    const r = await m.companion().responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "done", fim: "entregue" })
    expect(r.saida.origem).toBe("agente")
    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    const validacoes = etapas.filter((e) => e.tipo === "validacao")
    expect(validacoes.map((e) => e.status)).toEqual(["recusado", "ok"])
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.status).toBe("done")
  })

  it("terceira recusa termina com saída segura, done e etapa de limite", async () => {
    const m = await montar([finalizar(entregaRuim), finalizar(entregaRuim), finalizar(entregaRuim)])
    const r = await m.companion().responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "done", fim: "limite", motivo: "validacao" })
    expect(r.saida.origem).toBe("segura")
    expect(r.saida.sugestoes).toEqual([])
    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(etapas.find((e) => e.tipo === "erro")?.nome).toBe("limite:validacao")
  })

  it("teto de chamadas de modelo termina com limite:chamadas", async () => {
    const semFim = Array.from({ length: 6 }, () => ({ texto: "pensando" }))
    const m = await montar(semFim)
    const r = await m.companion().responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "done", fim: "limite", motivo: "chamadas" })
    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(etapas.filter((e) => e.nome === "limite:chamadas")).toHaveLength(1)
  })

  it("erro do loop devolve a saída segura e o run failed", async () => {
    const m = await montar([{ erro: "indisponivel" }, { erro: "indisponivel" }])
    const r = await m.companion().responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "failed", fim: "erro", motivo: "indisponivel" })
    expect(r.saida.origem).toBe("segura")
    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(etapas.filter((e) => e.tipo === "erro" && e.nome === "indisponivel")).toHaveLength(1)
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.saida).toMatchObject({ origem: "segura" })
  })

  it("sem vaga antes do loop usa o caminho sem_modelo e soma a métrica", async () => {
    const m = await montar([], { semModelo: true })
    const r = await m.companion().responder(m.conta.id, entrada({ estados: ["com_frio"] }))
    expect(r).toMatchObject({ status: "done", fim: "sem_modelo" })
    expect(r.saida.origem).toBe("sem_modelo")
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run).toMatchObject({ caminho: "sem_modelo", status: "done" })
    const soma = m.telemetry.metricas.filter((x) => x.nome === "ritu_fallback_sem_llm_total")
    expect(soma.reduce((t, x) => t + x.valor, 0)).toBe(1)
  })

  it("sem modelo no meio do loop também dá saída sem_modelo, done e métrica", async () => {
    const m = await montar([])
    const semProximo = {
      temModelo: async () => true,
      paraPapel: () => ({
        proximo: async () => null,
        usou: async () => undefined,
        falhou: async () => undefined,
      }),
    } as ModelRouter
    const r = await m.companion(semProximo).responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "done", fim: "sem_modelo" })
    expect(r.saida.origem).toBe("sem_modelo")
    const soma = m.telemetry.metricas.filter((x) => x.nome === "ritu_fallback_sem_llm_total")
    expect(soma.reduce((t, x) => t + x.valor, 0)).toBe(1)
  })

  it("clima indisponível e sem cidade ainda termina em done com resposta do agente", async () => {
    const m = await montar([
      { chamadas: [{ nome: "clima.agora", argumentos: {} }] },
      finalizar(entregaOk),
    ])
    const r = await m.companion().responder(m.conta.id, entrada())
    expect(r).toMatchObject({ status: "done", fim: "entregue" })
    expect(r.saida.origem).toBe("agente")
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.clima_usado).toBeNull()
  })

  it("grava saida, momento, incômodo, clima sem cidade, prompt, modelos e trocas", async () => {
    const m = await montar([
      { chamadas: [{ nome: "clima.agora", argumentos: {} }] },
      finalizar(entregaDoMomento),
    ])
    await m.stores.profiles.definirCidade(m.conta.id, {
      nome: "Cidade Secreta",
      lat: -23.5,
      lon: -46.6,
      fuso: "America/Sao_Paulo",
    })
    const r = await m
      .companion()
      .responder(m.conta.id, entrada({ intencoes: ["momento"], estados: ["com_frio"] }))
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.saida).toMatchObject({ origem: "agente" })
    expect(run?.momento?.estados).toEqual(["com_frio"])
    expect(run?.momento?.gunas_buscadas).toEqual(expect.arrayContaining(["quente"]))
    expect(run?.com_incomodo).toBe(false)
    expect(run?.clima_usado).toMatchObject({ status: "ok" })
    expect(JSON.stringify(run?.clima_usado)).not.toContain("Cidade Secreta")
    expect(run?.prompt_versao).toEqual(expect.any(String))
    expect(run?.modelos).toEqual({ decisao: ["gemini-3.5-flash-lite"] })
    expect(run?.trocas_de_modelo).toBe(0)
    const intencoes = m.telemetry.metricas.filter((x) => x.nome === "ritu_run_intencao_total")
    expect(intencoes.map((x) => x.rotulos)).toEqual([{ intencao: "momento" }])
  })

  it("com incômodo grava com_incomodo", async () => {
    const m = await montar([finalizar(entregaDoMomento)])
    const r = await m.companion().responder(
      m.conta.id,
      entrada({
        intencoes: ["momento"],
        estados: ["com_frio"],
        incomodo: { id: "dor_de_cabeca" },
      }),
    )
    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.com_incomodo).toBe(true)
  })

  it("o pensamento chega a aoVivo cortado em 160 e não vai para run_etapas", async () => {
    const longo = "p".repeat(300)
    const m = await montar([
      { texto: longo, chamadas: [{ nome: "clima.agora", argumentos: {} }] },
      finalizar(entregaOk),
    ])
    const eventos: { tipo: string; texto?: string }[] = []
    const r = await m.companion().responder(m.conta.id, entrada({ texto: TEXTO_DA_PESSOA }), {
      aoVivo: (e) => eventos.push(e as never),
    })
    const pensamento = eventos.find((e) => e.tipo === "pensamento")
    expect(pensamento?.texto).toHaveLength(160)
    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(JSON.stringify(etapas)).not.toContain("ppppp")
    expect(JSON.stringify(etapas)).not.toContain(TEXTO_DA_PESSOA)
    expect(tipos(etapas)).toContain("llm")
  })

  describe("com run já criado", () => {
    const iniciar = (m: Awaited<ReturnType<typeof montar>>, runs = m) =>
      createRunService({
        stores: runs.stores,
        tx: runs.stores,
        runtime: createScriptedRuntime([], runs.clock),
        clock: runs.clock,
        telemetry: runs.telemetry,
      }).iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: ["pergunta"] })

    it("opts.run não cria outro run, encerra o dado e não soma a intenção", async () => {
      const m = await montar([finalizar(entregaOk)])
      const run = await iniciar(m)
      const r = await m.companion().responder(m.conta.id, entrada(), { run })
      expect(r).toMatchObject({ run_id: run.id, status: "done", fim: "entregue" })
      const salvo = await m.stores.runs.buscar(m.conta.id, run.id)
      expect(salvo?.status).toBe("done")
      expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_run_intencao_total")).toHaveLength(
        0,
      )
    })

    it("semModelo com run termina done com caminho sem_modelo", async () => {
      const m = await montar([])
      const run = await iniciar(m)
      const r = await m.companion().responder(m.conta.id, entrada(), { run, semModelo: true })
      expect(r).toMatchObject({ run_id: run.id, status: "done", fim: "sem_modelo" })
      const salvo = await m.stores.runs.buscar(m.conta.id, run.id)
      expect(salvo).toMatchObject({ status: "done", caminho: "sem_modelo" })
      expect(
        m.telemetry.metricas.filter((x) => x.nome === "ritu_fallback_sem_llm_total"),
      ).toHaveLength(1)
    })

    it("sem opts.run, soma a intenção como antes", async () => {
      const m = await montar([finalizar(entregaOk)])
      await m.companion().responder(m.conta.id, entrada())
      expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_run_intencao_total")).toHaveLength(
        1,
      )
    })

    it("o ToolContext recebe casaDaMensagem", async () => {
      const m = await montar([finalizar(entregaOk)])
      const run = await iniciar(m)
      const casa = { tem: ["abobora"], acabou: [] }
      let visto: unknown
      const runs = createRunService({
        stores: m.stores,
        tx: m.stores,
        runtime: createScriptedRuntime([finalizar(entregaOk)], m.clock),
        clock: m.clock,
        telemetry: m.telemetry,
      })
      const original = runs.executarRun
      runs.executarRun = (contaId, runId, p) => {
        visto = (p.ctx as { casaDaMensagem?: unknown }).casaDaMensagem
        return original(contaId, runId, p)
      }
      const c = createCompanion({
        stores: m.stores,
        kb,
        clock: m.clock,
        weather: m.weather,
        router: m.router,
        runs,
        telemetry: m.telemetry,
      })
      await c.responder(m.conta.id, entrada({ casa_da_mensagem: casa }), { run })
      expect(visto).toEqual(casa)
    })
  })
})
