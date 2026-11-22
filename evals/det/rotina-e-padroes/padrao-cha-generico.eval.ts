import { describe, expect, it } from "vitest"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { Estado } from "@/core/knowledge/vocab"
import type { Resultado } from "@/core/outcomes/ports"
import { detectarPadroesDaConta } from "@/core/patterns/job"
import { padraoVale } from "@/core/patterns/vale"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// O padrão do chá é genérico: "<estados>|cha", com ervas diferentes contando juntas. Três "ajudou" com frio e agitada (um de gengibre com canela, dois de louro) viram um padrão só, e ele vale na base real.

const kb = getContainer().knowledge
const AGORA = "2026-06-03T20:00:00Z"
const DIA_MS = 86_400_000
const CONTA = "c1"
const FRIO_AGITADA: Estado[] = ["com_frio", "agitada"]
const CHAVE = "com_frio+agitada|cha"
const FRASE = "Quando você está com frio e agitada, um chá costuma te ajudar."

function montar() {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  return { clock, stores, telemetry, deps: { stores, kb, clock, telemetry } }
}

type Montagem = ReturnType<typeof montar>

// Um run done por dia, com o momento e o chá que a pessoa tomou e o resultado que deu.
async function semearRetornos(
  m: Montagem,
  itensPorDia: { pratica: string; resultado: Resultado }[],
) {
  for (const [i, { pratica, resultado }] of itensPorDia.entries()) {
    m.clock.set(new Date(Date.parse(AGORA) - (i + 2) * DIA_MS).toISOString())
    const dia = m.clock.now().toISOString().slice(0, 10)
    const run = await m.stores.runs.criar(CONTA, { caminho: "acompanhante", intencoes: [], dia })
    await m.stores.runs.atualizar(CONTA, run.id, {
      status: "done",
      com_incomodo: false,
      momento: { estados: FRIO_AGITADA, momento_do_dia: "noite", gunas_buscadas: [] },
    })
    const sugestao = { tipo: "cha" as const, pratica_id: pratica, alimentos: [], titulo: "Chá" }
    const [r] = await m.stores.outcomes.criar(CONTA, run.id, [sugestao])
    if (r) await m.stores.outcomes.responder(CONTA, r.id, resultado, "toque")
  }
  m.clock.set(AGORA)
}

describe("padrão do chá genérico: ervas diferentes contam juntas", () => {
  it("três ajudou com frio e agitada, de ervas diferentes, viram um padrão <estados>|cha", async () => {
    const m = montar()
    await semearRetornos(m, [
      { pratica: "cha-gengibre-canela", resultado: "ajudou" },
      { pratica: "cha-louro", resultado: "ajudou" },
      { pratica: "cha-louro", resultado: "ajudou" },
    ])

    // Os dois dias com frio e agitada juntos também viram um padrão de estados juntos; aqui só importa o do chá.
    await detectarPadroesDaConta(m.deps, CONTA)
    const doCha = (await m.stores.patterns.listar(CONTA)).filter(
      (p) => p.tipo === "ajuda_em_estado",
    )
    expect(doCha).toHaveLength(1)
    expect(doCha[0]).toMatchObject({
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
      status: "candidato",
    })
  })

  it("o padrão vale na base real para a pessoa sem filtro", async () => {
    const m = montar()
    await semearRetornos(m, [
      { pratica: "cha-gengibre-canela", resultado: "ajudou" },
      { pratica: "cha-louro", resultado: "ajudou" },
      { pratica: "cha-louro", resultado: "ajudou" },
    ])
    await detectarPadroesDaConta(m.deps, CONTA)
    const padrao = (await m.stores.patterns.listar(CONTA)).find((p) => p.tipo === "ajuda_em_estado")
    if (!padrao) throw new Error("padrão não proposto")

    expect(padraoVale(padrao, filtroVazio, kb)).toBe(true)
  })
})
