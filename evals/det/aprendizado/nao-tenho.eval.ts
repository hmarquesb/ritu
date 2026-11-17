import { describe, expect, it } from "vitest"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import { getContainer } from "@/infra/container"
import {
  cenarios,
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// "Não tenho": o item fica acabado, a falta é gravada e a troca segue no mesmo toque; a falta conta para o "vale ter em casa".

const kb = getContainer().knowledge

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// O run do troca-por-toque sem toques: canela no chá, noz-moscada confirmada em casa.
async function montarSemToque(extra: Partial<CenarioDeConversa> = {}) {
  const base = cenario("troca-por-toque")
  const c: CenarioDeConversa = { ...base, ...extra, toques: undefined }
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, runId: rodada.final.run_id }
}

async function saidaDo(deps: DepsDoCenario, contaId: string, runId: string) {
  const run = await deps.stores.runs.buscar(contaId, runId)
  return run?.saida as SaidaDoAcompanhante
}

// A canela do chá já trocada duas vezes: a noz-moscada atual é a terceira troca, e o teto não deixa mais.
function ateOTeto(saida: SaidaDoAcompanhante): SaidaDoAcompanhante {
  return {
    ...saida,
    sugestoes: saida.sugestoes.map((sg, i) =>
      i === 0
        ? {
            ...sg,
            itens: sg.itens.map((it) =>
              it.alimento_id === "canela"
                ? {
                    ...it,
                    troca: {
                      alimento_id: "noz-moscada",
                      nome: "Noz-moscada",
                      contribui: ["quente"],
                      verbos: ["aquecem"],
                      linha_base: "alimentos:noz-moscada",
                      frase: "Troquei canela por noz-moscada.",
                      anteriores: ["cardamomo", "louro"],
                    },
                  }
                : it,
            ),
          }
        : sg,
    ),
  }
}

const metricas = (deps: DepsDoCenario, nome: string, rotulos: Record<string, string>) =>
  deps.telemetry.metricas.filter(
    (m) =>
      m.nome === nome &&
      Object.entries(rotulos).every(
        ([chave, valor]) => (m.rotulos as Record<string, unknown>)[chave] === valor,
      ),
  )

// O preparo da próxima mensagem do momento frio-agitada, sem gravar nada.
async function preparoSeguinte(deps: DepsDoCenario, contaId: string): Promise<DadosDoPreparo> {
  const frio = cenarios["frio-agitada"]
  if (!frio?.entrada) throw new Error("cenário frio-agitada ausente")
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    frio.entrada,
  )
}

describe("não tenho: acabou, falta e troca no mesmo toque", () => {
  it("canela acabou, entra na falta e sai por noz-moscada, que estava confirmada", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "canela",
      motivo: "nao_tenho",
    })

    expect(resultado.resultado).toBe("trocou")
    if (resultado.resultado !== "trocou") throw new Error("troca não aconteceu")
    const item = resultado.sugestao.itens.find((i) => i.alimento_id === "canela")
    expect(item?.troca?.alimento_id).toBe("noz-moscada")
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === "canela")?.estado).toBe("acabou")
    const faltas = await deps.stores.shortages.diasComFalta(contaId, "2026-01-01")
    expect(faltas.map((f) => f.alimento_id)).toContain("canela")
  })

  it("a falta soma ritu_faltas_total com origem nao_tenho e a troca soma trocou, uma vez cada", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "canela",
      motivo: "nao_tenho",
    })

    expect(metricas(deps, "ritu_faltas_total", { origem: "nao_tenho" })).toHaveLength(1)
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "trocou" })).toHaveLength(1)
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "sem_substituto" })).toEqual(
      [],
    )
  })
})

describe("não tenho sem substituto: a falta fica, a troca responde sem_substituto", () => {
  it("no teto de trocas, o não tenho grava a falta e a troca diz sem_substituto", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    // Três trocas já feitas no canela: a noz-moscada atual tem dois anteriores, então não há mais troca.
    await deps.stores.runs.atualizar(contaId, runId, {
      saida: ateOTeto(await saidaDo(deps, contaId, runId)),
    })
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "noz-moscada",
      motivo: "nao_tenho",
    })

    expect(resultado.resultado).toBe("sem_substituto")
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === "noz-moscada")?.estado).toBe("acabou")
    expect(metricas(deps, "ritu_faltas_total", { origem: "nao_tenho" })).toHaveLength(1)
    expect(
      metricas(deps, "ritu_troca_ingrediente_total", { resultado: "sem_substituto" }),
    ).toHaveLength(1)
  })
})

describe("a falta conta para o 'vale ter em casa'", () => {
  it("com faltas em dois dias antes, o não tenho de hoje põe o alimento no para_ter do preparo seguinte", async () => {
    const { contaId, deps, runId } = await montarSemToque({
      faltas: [
        { alimento_id: "canela", diasAtras: 1 },
        { alimento_id: "canela", diasAtras: 2 },
      ],
    })
    const antes = await preparoSeguinte(deps, contaId)
    expect(antes.para_ter).toBeUndefined()

    await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "canela",
      motivo: "nao_tenho",
    })
    const depois = await preparoSeguinte(deps, contaId)

    expect(depois.para_ter?.alimento_id).toBe("canela")
    expect(depois.para_ter?.vezes).toBe(3)
  })
})
