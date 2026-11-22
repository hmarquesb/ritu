import { describe, expect, it } from "vitest"
import { rotasDaCasa } from "@/app/_rotas/casa"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { createContainer, getContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import {
  cenarios,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"

// Efeito dos toques da casa no preparo seguinte: "acabou", "não gosto", "sempre tenho", "tirar da lista" e
// "pôr na lista". Perfil semeado: o frio-agitada (casa com abóbora, arroz, ghee, gengibre e canela; cardamomo com
// falta em 3 dias). O relógio é o do cenário, então o momento do dia não muda.

const kb = getContainer().knowledge

function frioAgitada() {
  const c = cenarios["frio-agitada"]
  if (!c?.entrada) throw new Error("cenário frio-agitada ausente")
  return c
}

// O container da casa sobre os stores e o relógio do cenário: as rotas e as leituras usam o mesmo estado.
function containerDoCenario(deps: DepsDoCenario) {
  return createContainer({
    clock: deps.clock,
    stores: deps.stores,
    tx: { emTransacao: (fn) => fn(deps.stores) },
    telemetry: deps.telemetry,
    limiter: createMemoryLimiter(),
  })
}

function rotasDoCenario(deps: DepsDoCenario, contaId: string) {
  return rotasDaCasa({
    contaDaSessao: async () => contaId,
    quemPede: () => ({ ipHash: "h" }),
    container: containerDoCenario(deps),
  })
}

// Monta o cenário com o perfil semeado e as rotas da casa.
async function montar() {
  const c = frioAgitada()
  const { contaId, deps } = await montarCenario(c)
  const container = containerDoCenario(deps)
  const rotas = rotasDoCenario(deps, contaId)
  return { c, contaId, deps, container, rotas }
}

type Montagem = Awaited<ReturnType<typeof montar>>

// O preparo da mensagem do momento frio-agitada, sem gravar nada.
function preparoSeguinte(m: Montagem): Promise<DadosDoPreparo> {
  return preparar(
    { stores: m.deps.stores, kb, clock: m.deps.clock, telemetry: m.deps.telemetry },
    m.contaId,
    frioAgitada().entrada,
  )
}

const alimentosNosCandidatos = (p: DadosDoPreparo): string[] =>
  p.candidatos.flatMap((cand) => cand.itens.map((i) => i.alimento_id))

const pedido = (corpo: unknown): Request =>
  new Request("http://x/api/casa", { method: "POST", body: JSON.stringify(corpo) })

const DESDE = "2000-01-01"

async function itemDaCasa(m: Montagem, alimentoId: string) {
  const item = (await m.deps.stores.pantry.listar(m.contaId)).find(
    (i) => i.alimento_id === alimentoId,
  )
  if (!item) throw new Error(`${alimentoId} não está na casa`)
  return item
}

describe("acabou pela rota", () => {
  it("sai da casa no preparo seguinte, vai para acabou, e não grava falta", async () => {
    const m = await montar()
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).toContain("gengibre")
    const item = await itemDaCasa(m, "gengibre")

    const resposta = await m.rotas.tocarCasa(pedido({ acao: "acabou", item_id: item.id }))

    expect(resposta.status).toBe(200)
    const depois = await preparoSeguinte(m)
    expect(depois.acabou).toContain("gengibre")
    expect(depois.casa.confirmados).not.toContain("gengibre")
    const nosCandidatos = depois.candidatos.flatMap((cand) => cand.itens)
    expect(
      nosCandidatos.filter((i) => i.alimento_id === "gengibre").map((i) => i.casa),
    ).not.toContain("confirmado")
    const faltas = await m.deps.stores.shortages.diasComFalta(m.contaId, DESDE)
    expect(faltas.map((f) => f.alimento_id)).not.toContain("gengibre")
  })
})

describe("não gosto pela rota", () => {
  it("tira o alimento dos candidatos do preparo seguinte", async () => {
    const m = await montar()
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).toContain("gengibre")

    const resposta = await m.rotas.preferencias(
      pedido({ alimento_id: "gengibre", gosto: "nao_gosta" }),
    )

    expect(resposta.status).toBe(200)
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).not.toContain("gengibre")
  })
})

describe("sempre tenho num item incerto", () => {
  it("tira o item de ainda_tem da casa", async () => {
    const m = await montar()
    // Leite confirmado há mais de um ano: incerto, com o relógio de volta ao do cenário depois.
    m.deps.clock.set("2025-01-01T12:00:00.000Z")
    await m.deps.stores.pantry.registrar(m.contaId, [{ alimento_id: "leite" }], "conversa")
    m.deps.clock.set(m.c.agora)
    const item = await itemDaCasa(m, "leite")
    expect((await m.container.lerCasa(m.contaId)).ainda_tem.map((i) => i.id)).toContain(item.id)

    const resposta = await m.rotas.tocarCasa(
      pedido({ acao: "sempre_tenho", item_id: item.id, valor: true }),
    )

    expect(resposta.status).toBe(200)
    expect((await m.container.lerCasa(m.contaId)).ainda_tem.map((i) => i.id)).not.toContain(item.id)
  })
})

describe("tirar da lista", () => {
  it("apaga as faltas do alimento e o para_ter dele não volta no preparo seguinte", async () => {
    const m = await montar()
    expect((await preparoSeguinte(m)).para_ter?.alimento_id).toBe("cardamomo")
    await m.rotas.lista(pedido({ acao: "por", alimento_id: "cardamomo" }))

    const resposta = await m.rotas.lista(pedido({ acao: "tirar", alimento_id: "cardamomo" }))

    expect(resposta.status).toBe(200)
    const faltas = await m.deps.stores.shortages.diasComFalta(m.contaId, DESDE)
    expect(faltas.map((f) => f.alimento_id)).not.toContain("cardamomo")
    const lista = await m.deps.stores.shortages.lista(m.contaId)
    expect(lista.map((l) => l.alimento_id)).not.toContain("cardamomo")
    expect((await preparoSeguinte(m)).para_ter?.alimento_id).not.toBe("cardamomo")
  })
})

describe("pôr na lista de alimento com proposta recusada", () => {
  it("grava a linha com motivo pessoa", async () => {
    const c = cenariosDeConversa["so-atalhos"]
    if (!c) throw new Error("cenário so-atalhos ausente")
    const { contaId, deps } = await montarCenario(c)
    const { final } = await rodarCenario(deps, contaId, c, { decidir: async () => [] })
    const alimento = final.saida?.para_ter?.alimento_id ?? ""
    expect(alimento).not.toBe("")
    expect((await deps.stores.proposals.recusadas(contaId, "lista.propor")).length).toBe(1)

    const rotas = rotasDoCenario(deps, contaId)
    const resposta = await rotas.lista(pedido({ acao: "por", alimento_id: alimento }))

    expect(resposta.status).toBe(200)
    const linha = (await deps.stores.shortages.lista(contaId)).find(
      (l) => l.alimento_id === alimento,
    )
    expect(linha?.motivo).toBe("pessoa")
  })
})
