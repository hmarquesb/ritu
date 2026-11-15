import { describe, expect, it } from "vitest"
import type { Candidato } from "@/core/ranking/tipos"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { EntradaDoAcompanhante } from "./entrada"
import { dadosDoPreparoSchema, entregaveisEmCasa, preparar } from "./preparo"

const CONTA = "conta-1"
const HOJE = "2026-11-15"
const kb = createMiniKnowledge()

function montar() {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const deps = { stores, kb, clock, telemetry }
  return {
    stores,
    telemetry,
    run: (e: Partial<EntradaDoAcompanhante>) => preparar(deps, CONTA, entrada(e)),
  }
}

function entrada(parcial: Partial<EntradaDoAcompanhante>): EntradaDoAcompanhante {
  return { intencoes: ["momento"], estados: [], evitar_da_mensagem: [], ...parcial }
}

describe("preparar", () => {
  it("com_frio e agitada buscam quente e estavel e devolvem dados válidos", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio", "agitada"] })
    expect(dados.qualidades.buscadas).toEqual(expect.arrayContaining(["quente", "estavel"]))
    expect(dados.candidatos.length).toBeGreaterThan(0)
    expect(dados.dia).toBe(HOJE)
    expect(dados.geral).toBe(true)
    expect(dadosDoPreparoSchema.safeParse(dados).success).toBe(true)
  })

  it("item da mensagem filtra no mesmo run e fica em evitar_temporario, sem motivo", async () => {
    const { run, stores } = montar()
    const dados = await run({ estados: ["com_frio"], evitar_da_mensagem: ["gengibre"] })
    expect(dados.filtro.evitar).toContainEqual({ tipo: "alimento", valor: "gengibre" })
    const ids = dados.candidatos.flatMap((c) => c.itens.map((i) => i.alimento_id))
    expect(ids).not.toContain("gengibre")
    expect(await stores.profiles.evitarTemporario(CONTA, HOJE)).toEqual([
      { tipo: "alimento", valor: "gengibre" },
    ])
  })

  it("texto fora da base vai para evitar_textos", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"], evitar_da_mensagem: ["coentro fresco"] })
    expect(dados.evitar_textos).toEqual(["coentro fresco"])
  })

  it("pergunta sem estados não tem candidatos nem faltas", async () => {
    const { run } = montar()
    const dados = await run({ intencoes: ["pergunta"] })
    expect(dados.candidatos).toEqual([])
    expect(dados.faltas_do_run).toEqual([])
    expect(dados.para_ter).toBeUndefined()
  })

  it("com três dias de falta nos últimos 30, devolve para_ter; com incômodo, não", async () => {
    const { run, stores } = montar()
    const falta = [{ alimento_id: "gengibre", origem: "nao_tenho" as const }]
    await stores.shortages.registrar(CONTA, falta, "2026-11-13")
    await stores.shortages.registrar(CONTA, falta, "2026-11-14")
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.faltas_do_run).toContain("gengibre")
    expect(dados.para_ter?.alimento_id).toBe("gengibre")
    expect(dados.para_ter?.vezes).toBe(3)

    const comIncomodo = await run({
      estados: ["com_frio"],
      incomodo: { id: "gases", variante: "unica" },
    })
    expect(comIncomodo.com_incomodo).toBe(true)
    expect(comIncomodo.para_ter).toBeUndefined()
  })

  it("o que já foi sugerido hoje sai dos candidatos", async () => {
    const { run, stores } = montar()
    const antes = await run({ estados: ["com_frio"] })
    expect(antes.candidatos.some((c) => c.id === "cha-gengibre")).toBe(true)
    const criado = await stores.runs.criar(CONTA, {
      caminho: "acompanhante",
      intencoes: ["momento"],
      dia: HOJE,
    })
    await stores.runs.atualizar(CONTA, criado.id, {
      status: "done",
      saida: { sugestoes: [{ tipo: "cha", pratica_id: "cha-gengibre" }] },
    })
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.sugeridos_hoje).toEqual(["praticas:cha-gengibre"])
    expect(dados.candidatos.some((c) => c.id === "cha-gengibre")).toBe(false)
  })

  it("casa e fixos: confirmados, nomes da base e texto do não como", async () => {
    const { run, stores } = montar()
    await stores.pantry.registrar(CONTA, [{ alimento_id: "gengibre" }], "tela")
    await stores.profiles.definirNaoCome(CONTA, [
      { tipo: "alimento", valor: "banana" },
      { tipo: "texto", valor: "coentro" },
    ])
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.casa.confirmados).toContain("gengibre")
    expect(dados.fixos.nao_come).toEqual(["Banana", "coentro"])
    expect(dados.sinais.itens_confirmados_em_casa).toBe(1)
  })

  it("o span preparo leva os atributos e nenhum nome de alimento", async () => {
    const { run, telemetry } = montar()
    const dados = await run({ estados: ["com_frio"] })
    const span = telemetry.spans.find((s) => s.nome === "preparo")
    expect(span?.atributos["candidatos.total"]).toBe(dados.candidatos.length)
    expect(span?.atributos["faltas.registradas"]).toBe(dados.faltas_do_run.length)
    expect(typeof span?.atributos["para_ter.candidato"]).toBe("boolean")
    expect(JSON.stringify(span?.atributos)).not.toContain("gengibre")
  })
})

describe("entregaveisEmCasa", () => {
  const item = (alimento_id: string, casa: "confirmado" | "incerto" | "ausente") => ({
    alimento_id,
    nome: alimento_id,
    casa,
    contribui: [],
    linha_base: "",
  })
  const refeicao = (opcoes: Candidato["opcoes"]): Candidato => ({
    tipo: "refeicao",
    id: "pure-de-raiz",
    nome: "Purê de raiz",
    itens: [],
    opcoes,
    contribui: [],
    linha_base: "",
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade: false,
    no_fim: false,
  })
  const vazia = { confirmados: [], incertos: [] }

  it("sai a refeição cuja vaga obrigatória só tem opção ausente de casa", () => {
    const c = refeicao({
      base: [item("abobora", "ausente")],
      gordura: [item("ghee", "confirmado")],
    })
    expect(entregaveisEmCasa([c], { confirmados: ["ghee"], incertos: [] }, kb)).toEqual([])
  })

  it("fica com opção confirmada ou incerta em cada vaga obrigatória", () => {
    const c = refeicao({
      base: [item("abobora", "ausente"), item("cenoura", "incerto")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: ["cenoura"] }
    expect(entregaveisEmCasa([c], casa, kb)).toEqual([c])
  })

  it("não mexe em chá, óleo nem prática", () => {
    const cha = { ...refeicao({}), tipo: "cha" as const, id: "cha-gengibre" }
    expect(entregaveisEmCasa([cha], vazia, kb)).toEqual([cha])
  })

  it("as faltas e o para_ter não mudam com o filtro", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.faltas_do_run).toEqual(expect.arrayContaining(["gengibre"]))
    expect(dados.candidatos.length).toBeGreaterThan(0)
  })
})
