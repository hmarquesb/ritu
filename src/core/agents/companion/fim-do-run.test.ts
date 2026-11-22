import { describe, expect, it } from "vitest"
import type { Pergunta } from "@/core/runs/pergunta"
import type { ResultadoDoRun } from "@/core/runs/run-service"
import { createRunService } from "@/core/runs/run-service"
import type { Transactor } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import type { EntradaDoAcompanhante } from "./entrada"
import { criarFimDoRun } from "./fim-do-run"
import { preparar } from "./preparo"
import { type SugestaoEntregue, saidaSegura } from "./saida"

const kb = createMiniKnowledge()

const entrada = (e: Partial<EntradaDoAcompanhante> = {}): EntradaDoAcompanhante => ({
  intencoes: ["pergunta"],
  estados: [],
  evitar_da_mensagem: [],
  ...e,
})

const perguntaDeCome: Pergunta = {
  tipo: "come",
  texto: "Você comeu arroz hoje?",
  alimento_id: "arroz",
  nome: "arroz",
}

async function montar(opts: { tx?: (s: Transactor) => Transactor } = {}) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runs = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime([], clock),
    clock,
    telemetry,
  })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const fim = criarFimDoRun({ stores, tx: opts.tx?.(stores) ?? stores, kb, runs, telemetry })
  const dados = await preparar({ stores, kb, clock, telemetry }, conta.id, entrada())
  const perfil = await stores.profiles.ler(conta.id)

  // Run como o loop o deixa ao pausar: waiting_for_input.
  const aberto = await runs.iniciarRun(conta.id, {
    caminho: "acompanhante",
    intencoes: ["pergunta"],
  })
  await stores.runs.mudarStatusSe(conta.id, aberto.id, "running", "waiting_for_input")
  const run = await stores.runs.buscar(conta.id, aberto.id)
  if (!run) throw new Error("run de teste não encontrado")

  const pausa = (conteudo: unknown): ResultadoDoRun => ({
    run,
    fim: {
      tipo: "pausa",
      pendencia: { tipo: "pergunta", conteudo, criada_em: clock.now().toISOString() },
    },
  })

  return { stores, conta, fim, dados, perfil, pausa, run, telemetry }
}

describe("criarFimDoRun.tratar · pausa", () => {
  it("conteúdo de pausa inválido termina em failed, com etapa pausa_invalida e saída segura", async () => {
    const m = await montar()
    const r = await m.fim.tratar(
      m.conta.id,
      m.pausa({ origem: "desconhecida" }),
      m.dados,
      m.perfil,
      {},
    )
    expect(r).toMatchObject({ status: "failed", fim: "erro", motivo: "pausa_invalida" })
    expect(r.saida?.origem).toBe("segura")
    expect(r.pergunta).toBeUndefined()

    const etapas = await m.stores.runs.etapas(m.conta.id, r.run_id)
    expect(etapas.filter((e) => e.tipo === "erro" && e.nome === "pausa_invalida")).toHaveLength(1)

    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.status).toBe("failed")
    expect(run?.saida).toMatchObject({ origem: "segura" })
  })

  it("conteúdo de pausa válido fica waiting_for_input, sem saída e com a pergunta", async () => {
    const m = await montar()
    const r = await m.fim.tratar(
      m.conta.id,
      m.pausa({ origem: "agente", pergunta: perguntaDeCome }),
      m.dados,
      m.perfil,
      {},
    )
    expect(r).toMatchObject({
      status: "waiting_for_input",
      fim: "pausa",
      pergunta: perguntaDeCome,
    })
    expect(r.saida).toBeUndefined()

    const run = await m.stores.runs.buscar(m.conta.id, r.run_id)
    expect(run?.status).toBe("waiting_for_input")
  })
})

describe("criarFimDoRun.tratar · manterAberto", () => {
  it("desfecho done com o run em running só grava os campos e devolve running", async () => {
    const m = await montar()
    await m.stores.runs.mudarStatusSe(m.conta.id, m.run.id, "waiting_for_input", "running")
    const aberto = { ...m.run, status: "running" as const }
    const r = await m.fim.tratar(
      m.conta.id,
      { run: aberto, fim: { tipo: "sem_modelo" } },
      m.dados,
      m.perfil,
      {},
      true,
    )
    expect(r).toMatchObject({ status: "running", fim: "sem_modelo" })
    const salvo = await m.stores.runs.buscar(m.conta.id, m.run.id)
    expect(salvo?.status).toBe("running")
    expect(salvo?.saida).toMatchObject({ origem: "sem_modelo" })
  })
})

const sugestao: SugestaoEntregue = {
  tipo: "cha",
  pratica_id: "cha-a",
  titulo: "Chá",
  como_fazer: "",
  itens: [],
  verbos: [],
  motivo: "",
  linhas_base: [],
  novidade: false,
}

describe("criarFimDoRun.tratar · registro da entrega", () => {
  async function aberto(opts: Parameters<typeof montar>[0] = {}) {
    const m = await montar(opts)
    await m.stores.runs.mudarStatusSe(m.conta.id, m.run.id, "waiting_for_input", "running")
    const run = { ...m.run, status: "running" as const }
    const faltas = { ...m.dados, casa: { confirmados: [], incertos: [] }, faltas_do_run: ["leite"] }
    const agente = { ...saidaSegura(m.dados), origem: "agente" as const, sugestoes: [sugestao] }
    return { ...m, run, faltas, agente }
  }
  const retornos = (m: Awaited<ReturnType<typeof aberto>>) =>
    m.stores.outcomes.doRun(m.conta.id, m.run.id)

  it("fim entregue válido grava e a saída do run leva o retorno_id", async () => {
    const m = await aberto()
    const r = await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "entregue", saida: m.agente } },
      m.faltas,
      m.perfil,
      {},
    )
    const [retorno] = await retornos(m)
    expect(retorno?.status).toBe("aguardando")
    expect(r.saida?.sugestoes[0]?.retorno_id).toBe(retorno?.id)
    const salvo = await m.stores.runs.buscar(m.conta.id, m.run.id)
    const gravada = salvo?.saida as { sugestoes: { retorno_id?: string }[] } | undefined
    expect(gravada?.sugestoes[0]?.retorno_id).toBe(retorno?.id)
    expect(await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")).toEqual([
      expect.objectContaining({ alimento_id: "leite" }),
    ])
  })

  it("fim sem_modelo grava as faltas", async () => {
    const m = await aberto()
    await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "sem_modelo" } },
      m.faltas,
      m.perfil,
      {},
    )
    expect(await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")).toEqual([
      expect.objectContaining({ alimento_id: "leite" }),
    ])
  })

  it("saída inválida, limite e erro (saída segura) não gravam nada", async () => {
    const fins = [
      { tipo: "entregue" as const, saida: { lixo: true } },
      { tipo: "limite" as const, motivo: "chamadas" as const },
      { tipo: "erro" as const, codigo: "indisponivel" },
    ]
    for (const fimDoLoop of fins) {
      const m = await aberto()
      await m.fim.tratar(m.conta.id, { run: m.run, fim: fimDoLoop }, m.faltas, m.perfil, {})
      expect(await retornos(m)).toEqual([])
      expect(await m.stores.shortages.diasComFalta(m.conta.id, "2000-01-01")).toEqual([])
    }
  })

  it("falha no registro: o run segue, grava a etapa erro e a resposta chega sem retorno_id", async () => {
    const m = await aberto({
      tx: (s) => ({
        emTransacao: (fn) =>
          s.emTransacao((st) =>
            fn({
              ...st,
              shortages: {
                ...st.shortages,
                registrar: async () => {
                  throw new Error("falha")
                },
              },
            }),
          ),
      }),
    })
    const r = await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "entregue", saida: m.agente } },
      m.faltas,
      m.perfil,
      {},
    )
    expect(r.status).toBe("done")
    expect(r.saida?.sugestoes[0]?.retorno_id).toBeUndefined()
    expect(await retornos(m)).toEqual([])
    const etapas = await m.stores.runs.etapas(m.conta.id, m.run.id)
    expect(etapas.filter((e) => e.tipo === "erro" && e.nome === "registro_da_entrega")).toEqual([
      expect.objectContaining({ status: "falhou", resumo: null, modelo: null }),
    ])
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_faltas_total")).toHaveLength(0)
  })
})

describe("criarFimDoRun.tratar · resposta_segura", () => {
  const motivos = (telemetry: ReturnType<typeof createMemoryTelemetry>) =>
    telemetry.logs.filter((l) => l.codigo === "resposta_segura").map((l) => l.campos.motivo)

  it("entregue inválido loga saida_invalida, warn", async () => {
    const m = await montar()
    await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "entregue", saida: { lixo: true } } },
      m.dados,
      m.perfil,
      {},
    )
    expect(motivos(m.telemetry)).toEqual(["saida_invalida"])
    expect(m.telemetry.logs[0]?.nivel).toBe("warn")
  })

  it("limite loga limite com o motivo do fim", async () => {
    const m = await montar()
    await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "limite", motivo: "chamadas" } },
      m.dados,
      m.perfil,
      {},
    )
    expect(motivos(m.telemetry)).toEqual(["limite:chamadas"])
  })

  it("erro do loop loga o código do erro", async () => {
    const m = await montar()
    await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "erro", codigo: "indisponivel" } },
      m.dados,
      m.perfil,
      {},
    )
    expect(motivos(m.telemetry)).toEqual(["indisponivel"])
  })

  it("erro de montagem loga montagem e fecha o run como failed", async () => {
    const m = await montar()
    const r = await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "erro", codigo: "montagem" } },
      m.dados,
      m.perfil,
      {},
    )
    expect(motivos(m.telemetry)).toEqual(["montagem"])
    expect(r).toMatchObject({ fim: "erro", motivo: "montagem" })
    expect(r.saida?.origem).toBe("segura")
  })

  it("pausa com conteúdo inválido loga pausa_invalida", async () => {
    const m = await montar()
    await m.fim.tratar(m.conta.id, m.pausa({ origem: "desconhecida" }), m.dados, m.perfil, {})
    expect(motivos(m.telemetry)).toEqual(["pausa_invalida"])
  })

  it("sem_modelo não loga resposta_segura: a saída é a montada por código", async () => {
    const m = await montar()
    await m.fim.tratar(
      m.conta.id,
      { run: m.run, fim: { tipo: "sem_modelo" } },
      m.dados,
      m.perfil,
      {},
    )
    expect(motivos(m.telemetry)).toEqual([])
  })
})
