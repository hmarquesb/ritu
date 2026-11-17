import { describe, expect, it } from "vitest"
import { type SaidaDoAcompanhante, saidaDoAcompanhanteSchema } from "@/core/agents/companion/saida"
import { checarCombinacao } from "@/core/knowledge/combinacoes"
import { getContainer } from "@/infra/container"
import {
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Troca: o substituto é confirmado em casa, da mesma função, respeita filtros e combinações; o teto de três trocas vale nos dois toques.

const kb = getContainer().knowledge

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// O run do troca-por-toque sem toques: a canela do chá é o item a trocar.
async function montarSemToque(extra: Partial<CenarioDeConversa> = {}) {
  const base = cenario("troca-por-toque")
  const c: CenarioDeConversa = { ...base, ...extra, toques: undefined }
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, runId: rodada.final.run_id }
}

async function saidaDo(deps: DepsDoCenario, contaId: string, runId: string) {
  const run = await deps.stores.runs.buscar(contaId, runId)
  return saidaDoAcompanhanteSchema.parse(run?.saida)
}

// Troca a saída do run por outra (semente de teste: teto, evitar do dia).
async function alterarSaida(
  deps: DepsDoCenario,
  contaId: string,
  runId: string,
  mudar: (s: SaidaDoAcompanhante) => SaidaDoAcompanhante,
) {
  const saida = await saidaDo(deps, contaId, runId)
  await deps.stores.runs.atualizar(contaId, runId, { saida: mudar(saida) })
}

const trocarItem = (deps: DepsDoCenario, contaId: string, runId: string, alimento_id: string) =>
  deps.touches.trocarIngrediente(contaId, { runId, sugestao: 0, alimento_id, motivo: "trocar" })

function itemDoAlimento(saida: SaidaDoAcompanhante, alimento_id: string) {
  return saida.sugestoes[0]?.itens.find((i) => i.alimento_id === alimento_id)
}

const metricasDeTroca = (deps: DepsDoCenario, resultado: string) =>
  deps.telemetry.metricas.filter(
    (m) => m.nome === "ritu_troca_ingrediente_total" && m.rotulos.resultado === resultado,
  )

describe("troca cai num substituto confirmado da mesma função", () => {
  it("canela sai por noz-moscada, que está confirmada em casa e é da mesma função", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    const resultado = await trocarItem(deps, contaId, runId, "canela")

    expect(resultado.resultado).toBe("trocou")
    if (resultado.resultado !== "trocou") throw new Error("troca não aconteceu")
    const item = itemDoAlimento(await saidaDo(deps, contaId, runId), "canela")
    expect(item?.troca?.alimento_id).toBe("noz-moscada")
    expect(item?.troca?.anteriores).toEqual([])
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === "noz-moscada")?.estado).toBe("tem")
    expect(kb.alimento("noz-moscada")?.grupo).toBe(kb.alimento("canela")?.grupo)
    expect(kb.alimento("noz-moscada")?.funcoes).toEqual(kb.alimento("canela")?.funcoes)
  })

  it("a combinação da sugestão depois da troca continua compatível", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await trocarItem(deps, contaId, runId, "canela")
    const saida = await saidaDo(deps, contaId, runId)
    const ids = saida.sugestoes[0]?.itens.map((i) => i.troca?.alimento_id ?? i.alimento_id) ?? []

    expect(ids).toEqual(["gengibre", "noz-moscada"])
    expect(checarCombinacao(ids, kb).compativel).toBe(true)
  })

  it("filtro da pessoa: a noz-moscada em evitar_sempre não entra, e a troca não sai com ela", async () => {
    const { contaId, deps, runId } = await montarSemToque({
      perfil: {
        ...cenario("troca-por-toque").perfil,
        evitar_sempre: [{ tipo: "alimento", valor: "noz-moscada" }],
      },
    })
    const resultado = await trocarItem(deps, contaId, runId, "canela")

    expect(resultado.resultado).not.toBe("trocou")
    const item = itemDoAlimento(await saidaDo(deps, contaId, runId), "canela")
    expect(item?.troca).toBeUndefined()
  })
})

describe("item a evitar agora não entra na troca", () => {
  it("a noz-moscada em evitar do dia (saida.evitar) não é o substituto", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await alterarSaida(deps, contaId, runId, (s) => ({
      ...s,
      evitar: [{ texto: "noz-moscada", linha_base: "alimentos:noz-moscada" }],
    }))
    const resultado = await trocarItem(deps, contaId, runId, "canela")

    expect(resultado.resultado).not.toBe("trocou")
    expect(itemDoAlimento(await saidaDo(deps, contaId, runId), "canela")?.troca).toBeUndefined()
  })
})

describe("trocar de novo não repete o que já saiu", () => {
  it("depois de canela → noz-moscada, uma nova troca da noz-moscada não devolve a canela", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await trocarItem(deps, contaId, runId, "canela")
    // Anis-estrelado entra em casa depois da primeira troca: a segunda troca da noz-moscada sai por ele, e a canela não volta.
    await deps.stores.pantry.registrar(contaId, [{ alimento_id: "anis-estrelado" }], "conversa")
    const segunda = await trocarItem(deps, contaId, runId, "noz-moscada")
    const item = itemDoAlimento(await saidaDo(deps, contaId, runId), "canela")

    expect(segunda.resultado).toBe("trocou")
    expect(item?.troca?.alimento_id).toBe("anis-estrelado")
    expect(item?.troca?.anteriores).toEqual(["noz-moscada"])
    expect(item?.troca?.anteriores).not.toContain("canela")
  })
})

describe("teto de trocas por item (três)", () => {
  // Anis-estrelado confirmado em casa: sem o teto, a troca da noz-moscada sairia por ele.
  const montarComAnisEmCasa = () =>
    montarSemToque({
      casa: [...cenario("troca-por-toque").casa, { alimento_id: "anis-estrelado" }],
    })

  // Três trocas já feitas: o item tem dois anteriores e o substituto atual.
  const noTetoSemente = (s: SaidaDoAcompanhante): SaidaDoAcompanhante => ({
    ...s,
    sugestoes: s.sugestoes.map((sg, i) =>
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
  })

  it("no teto, trocar não muda a saída nem o retorno e marca sem_substituto", async () => {
    const { contaId, deps, runId } = await montarComAnisEmCasa()
    await alterarSaida(deps, contaId, runId, noTetoSemente)
    const antes = JSON.stringify(await saidaDo(deps, contaId, runId))
    const retornoAntes = (await deps.stores.outcomes.pendentes(contaId)).map((r) => r.sugestao)
    const resultado = await trocarItem(deps, contaId, runId, "noz-moscada")

    expect(resultado.resultado).toBe("sem_substituto")
    expect(JSON.stringify(await saidaDo(deps, contaId, runId))).toBe(antes)
    expect((await deps.stores.outcomes.pendentes(contaId)).map((r) => r.sugestao)).toEqual(
      retornoAntes,
    )
    expect(metricasDeTroca(deps, "sem_substituto")).toHaveLength(1)
    expect(metricasDeTroca(deps, "trocou")).toHaveLength(0)
  })

  it("no teto, responderTroca também não troca: o candidato não entra em casa", async () => {
    const { contaId, deps, runId } = await montarComAnisEmCasa()
    await alterarSaida(deps, contaId, runId, noTetoSemente)
    const resposta = await deps.touches.responderTroca(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "noz-moscada",
      candidato: "cominho",
      resposta: "tenho",
    })

    expect(resposta.resultado).toBe("sem_substituto")
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.some((i) => i.alimento_id === "cominho")).toBe(false)
    expect(metricasDeTroca(deps, "sem_substituto")).toHaveLength(1)
  })
})

describe("retorno e métricas da troca confirmada", () => {
  it("o retorno aguardando passa a ter o substituto e não a canela", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await trocarItem(deps, contaId, runId, "canela")
    const saida = await saidaDo(deps, contaId, runId)
    const retornoId = saida.sugestoes[0]?.retorno_id
    const retorno = (await deps.stores.outcomes.pendentes(contaId)).find((r) => r.id === retornoId)

    expect(retorno?.sugestao.alimentos).toEqual(expect.arrayContaining(["noz-moscada", "gengibre"]))
    expect(retorno?.sugestao.alimentos).not.toContain("canela")
    expect(retorno?.status).toBe("aguardando")
  })

  it("soma ritu_troca_ingrediente_total com resultado trocou e o span toque com motivo", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    await trocarItem(deps, contaId, runId, "canela")
    const span = deps.telemetry.spans.find((s) => s.nome === "toque")

    expect(metricasDeTroca(deps, "trocou")).toHaveLength(1)
    expect(span?.atributos).toMatchObject({ tipo: "troca", motivo: "trocar", resultado: "trocou" })
  })

  it("nenhuma chamada de modelo: etapas llm e passos do runtime iguais antes e depois", async () => {
    const { contaId, deps, runId } = await montarSemToque()
    const llmAntes = (await deps.stores.runs.etapas(contaId, runId)).filter((e) => e.tipo === "llm")
    const passosAntes = (deps.runtime as { pedidos?: unknown[] }).pedidos?.length ?? 0
    await trocarItem(deps, contaId, runId, "canela")
    const llmDepois = (await deps.stores.runs.etapas(contaId, runId)).filter(
      (e) => e.tipo === "llm",
    )
    const passosDepois = (deps.runtime as { pedidos?: unknown[] }).pedidos?.length ?? 0

    expect(llmDepois).toHaveLength(llmAntes.length)
    expect(passosDepois).toBe(passosAntes)
  })
})
