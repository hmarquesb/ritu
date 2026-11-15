import { describe, expect, it, vi } from "vitest"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { RespostaDaPessoa } from "@/core/runs/pergunta"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const DIA = "2026-06-15"
const DESDE = "2000-01-01"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

// Abóbora e couve incertas, como em casa-incerta, com a resposta da pessoa trocada.
function comRespostas(respostas: RespostaDaPessoa[]): CenarioDeConversa {
  return { ...cenario("casa-incerta"), respostas }
}

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps }
}

function linha(itens: ItemDaCasa[], id: string): ItemDaCasa | undefined {
  return itens.find((i) => i.alimento_id === id)
}

describe("gravação da Tenho e da Não tenho", () => {
  it("Tenho grava tem com origem pergunta, apaga a falta anterior e tira o item da lista Para ter em casa", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    await deps.stores.shortages.registrar(
      contaId,
      [{ alimento_id: "abobora", origem: "nao_tenho" }],
      DIA,
    )
    await deps.stores.shortages.porNaLista(contaId, {
      alimento_id: "abobora",
      motivo: "faltou_hoje",
      detalhe: "teste",
    })
    expect(await deps.stores.shortages.lista(contaId)).toHaveLength(1)

    await rodarCenario(deps, contaId, c)

    const casa = await deps.stores.pantry.listar(contaId)
    expect(linha(casa, "abobora")).toMatchObject({ estado: "tem", origem: "pergunta" })
    const faltas = await deps.stores.shortages.diasComFalta(contaId, DESDE)
    expect(faltas.map((f) => f.alimento_id)).not.toContain("abobora")
    const lista = await deps.stores.shortages.lista(contaId)
    expect(lista.map((i) => i.alimento_id)).not.toContain("abobora")
  })
})

describe("gravação da Não tenho", () => {
  it("Não tenho marca o item como acabou e grava a falta nao_tenho com o run_id", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    const registrar = vi.spyOn(deps.stores.shortages, "registrar")

    const rodada = await rodarCenario(deps, contaId, c)

    const casa = await deps.stores.pantry.listar(contaId)
    expect(linha(casa, "couve")?.estado).toBe("acabou")
    expect(registrar).toHaveBeenCalledWith(
      contaId,
      [{ alimento_id: "couve", origem: "nao_tenho", run_id: rodada.final.run_id }],
      expect.any(String),
    )
  })
})

describe("gravação do Não gosto", () => {
  it("Não gosto grava nao_gosta e não mexe no item da casa", async () => {
    const c = comRespostas([
      { tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "nao_gosto" }] },
    ])
    const { contaId, deps } = await montar(c)
    const antes = linha(await deps.stores.pantry.listar(contaId), "abobora")

    await rodarCenario(deps, contaId, c)

    const prefs = await deps.stores.preferences.ler(contaId)
    expect(prefs.find((p) => p.item_id === "abobora")?.gosto).toBe("nao_gosta")
    const depois = linha(await deps.stores.pantry.listar(contaId), "abobora")
    expect(depois?.estado).toBe(antes?.estado)
    expect(depois?.origem).toBe(antes?.origem)
  })
})

describe("pular e item sem resposta não gravam nada", () => {
  it("Pular não grava falta, gosto nem item da casa", async () => {
    const c = comRespostas([{ tipo: "pular" }])
    const { contaId, deps } = await montar(c)

    await rodarCenario(deps, contaId, c)

    expect(await deps.stores.shortages.diasComFalta(contaId, DESDE)).toEqual([])
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.some((i) => i.origem === "pergunta")).toBe(false)
  })

  it("o item que não veio na resposta (couve) não grava falta nem vira acabou", async () => {
    const c = comRespostas([
      { tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "tenho" }] },
    ])
    const { contaId, deps } = await montar(c)

    await rodarCenario(deps, contaId, c)

    const faltas = await deps.stores.shortages.diasComFalta(contaId, DESDE)
    expect(faltas.map((f) => f.alimento_id)).not.toContain("couve")
    const casa = await deps.stores.pantry.listar(contaId)
    expect(linha(casa, "couve")?.estado).not.toBe("acabou")
    expect(linha(casa, "abobora")).toMatchObject({ estado: "tem", origem: "pergunta" })
  })
})

describe("gravação antes do passo seguinte", () => {
  it("no primeiro passo depois da retomada, o que a pessoa respondeu já está gravado", async () => {
    const c = cenario("casa-incerta")
    const { contaId, deps } = await montar(c)
    let retomou = false
    let casaNoPasso: Promise<ItemDaCasa[]> | undefined
    let faltasNoPasso: ReturnType<typeof deps.stores.shortages.diasComFalta> | undefined

    // O fake lê o estado na hora da chamada: a leitura feita no aoVivo vê o que já foi gravado.
    await rodarCenario(deps, contaId, c, {
      responder: async (_p, i) => {
        retomou = true
        return c.respostas?.[i] ?? { tipo: "pular" }
      },
      aoVivo: (e) => {
        if (!retomou || casaNoPasso || e.tipo !== "etapa_iniciada") return
        casaNoPasso = deps.stores.pantry.listar(contaId)
        faltasNoPasso = deps.stores.shortages.diasComFalta(contaId, DESDE)
      },
    })

    expect(casaNoPasso).toBeDefined()
    const casa = await casaNoPasso
    expect(linha(casa ?? [], "abobora")).toMatchObject({ estado: "tem", origem: "pergunta" })
    expect(linha(casa ?? [], "couve")?.estado).toBe("acabou")
    const faltas = await faltasNoPasso
    expect(faltas?.map((f) => f.alimento_id)).toContain("couve")
  })
})
