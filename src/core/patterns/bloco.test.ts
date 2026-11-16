import { describe, expect, it } from "vitest"
import { filtroVazio } from "@/core/knowledge/filtros"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { padraoParaOBloco } from "./bloco"
import { chaveDeAjuda } from "./textos"

const kb = createMiniKnowledge()
const CHAVE = chaveDeAjuda(["com_frio", "agitada"], { tipo: "pratica", id: "cha-gengibre" })

async function montar() {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const run = await stores.runs.criar(conta.id, {
    caminho: "acompanhante",
    intencoes: [],
    dia: "2026-11-15",
  })
  const deps = { stores, kb, clock }
  async function candidato(chave = CHAVE, frase = "Frase.") {
    const p = await stores.patterns.propor(conta.id, {
      tipo: "ajuda_em_estado",
      chave,
      frase,
      ocorrencias: 3,
    })
    if (!p) throw new Error("padrão não criado")
    return p
  }
  async function proposta(padraoId: string, decisao?: "recusada" | "aprovada") {
    const [c] = await stores.proposals.criar(conta.id, run.id, [
      { tool: "padrao.confirmar", conteudo: { padrao_id: padraoId, frase: "x" } },
    ])
    if (c && decisao) await stores.proposals.decidir(conta.id, c.id, decisao)
    return c
  }
  const ver = (fuso?: string) =>
    padraoParaOBloco(deps, conta.id, { filtro: filtroVazio, ...(fuso ? { fuso } : {}) })
  return { clock, stores, conta, candidato, proposta, ver }
}

describe("padraoParaOBloco", () => {
  it("sem candidato, nada", async () => {
    const m = await montar()
    expect(await m.ver()).toEqual([])
  })

  it("um candidato vira uma linha padrao.confirmar", async () => {
    const m = await montar()
    const p = await m.candidato(CHAVE, "Quando você está com frio, chá ajuda.")
    expect(await m.ver()).toEqual([
      { tool: "padrao.confirmar", padrao_id: p.id, frase: "Quando você está com frio, chá ajuda." },
    ])
  })

  it("com dois candidatos, só o mais antigo", async () => {
    const m = await montar()
    const a = await m.candidato()
    m.clock.set("2026-11-15T19:00:00.000Z")
    await m.candidato(chaveDeAjuda(["seca"], { tipo: "pratica", id: "cha-gengibre" }))
    const r = await m.ver()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ padrao_id: a.id })
  })

  it("candidato que o filtro barra não aparece", async () => {
    const m = await montar()
    await m.candidato()
    const r = await padraoParaOBloco({ stores: m.stores, kb, clock: m.clock }, m.conta.id, {
      filtro: { ...filtroVazio, nao_come: ["gengibre"] },
    })
    expect(r).toEqual([])
  })

  it("com proposta criada hoje, não aparece; no dia seguinte, aparece", async () => {
    const m = await montar()
    const p = await m.candidato()
    await m.proposta(p.id)
    expect(await m.ver()).toEqual([])
    m.clock.set("2026-11-16T18:00:00.000Z")
    expect(await m.ver()).toHaveLength(1)
  })

  it("o dia usa o fuso do perfil", async () => {
    const m = await montar()
    const p = await m.candidato()
    await m.proposta(p.id) // 15/11 18:00Z = 15/11 15:00 em São Paulo
    m.clock.set("2026-11-16T01:00:00.000Z") // 15/11 22:00 em São Paulo: ainda hoje
    expect(await m.ver("America/Sao_Paulo")).toEqual([])
    expect(await m.ver("UTC")).toHaveLength(1)
  })

  it("com 3 propostas antigas sem resposta, não aparece mais e segue candidato", async () => {
    const m = await montar()
    const p = await m.candidato()
    await m.proposta(p.id, "recusada")
    m.clock.set("2026-11-16T18:00:00.000Z")
    await m.proposta(p.id)
    m.clock.set("2026-11-17T18:00:00.000Z")
    await m.proposta(p.id, "recusada")
    m.clock.set("2026-11-18T18:00:00.000Z")
    expect(await m.ver()).toEqual([])
    expect(await m.stores.patterns.listar(m.conta.id, "candidato")).toHaveLength(1)
  })

  it("com 2 propostas antigas, ainda aparece", async () => {
    const m = await montar()
    const p = await m.candidato()
    await m.proposta(p.id, "recusada")
    m.clock.set("2026-11-16T18:00:00.000Z")
    await m.proposta(p.id)
    m.clock.set("2026-11-17T18:00:00.000Z")
    expect(await m.ver()).toHaveLength(1)
  })

  it("proposta de outro padrão não bloqueia este", async () => {
    const m = await montar()
    const a = await m.candidato()
    const b = await m.candidato(chaveDeAjuda(["seca"], { tipo: "pratica", id: "cha-gengibre" }))
    await m.proposta(a.id)
    const r = await m.ver()
    expect(r[0]).toMatchObject({ padrao_id: b.id })
  })
})
