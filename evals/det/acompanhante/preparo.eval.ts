import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import {
  type DadosDoPreparo,
  dadosDoPreparoSchema,
  preparar,
} from "@/core/agents/companion/preparo"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import type { Candidato } from "@/core/ranking/tipos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const kb = getContainer().knowledge
const CONTA = "conta-1"
// 19h em São Paulo: momento "jantar".
const JANTAR = "2026-11-15T22:00:00.000Z"

function montar() {
  const clock = createFixedClock(JANTAR)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (parcial: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: [],
      evitar_da_mensagem: [],
      ...parcial,
    })
  return { stores, run }
}

const idsDoCandidato = (c: Candidato): string[] =>
  [...c.itens, ...Object.values(c.opcoes ?? {}).flatMap((itens) => itens ?? [])].map(
    (item) => item.alimento_id,
  )

const idsDosCandidatos = (dados: DadosDoPreparo): string[] =>
  dados.candidatos.flatMap(idsDoCandidato)

const contraindicacoesDo = (c: Candidato): string[] =>
  (c.tipo === "refeicao"
    ? kb.preparo(c.id)?.contraindicacoes
    : kb.pratica(c.id)?.contraindicacoes) ?? []

describe("momento → qualidades e candidatos da base real", () => {
  it.each(kb.estados.map((e) => e.id))(
    "%s: qualidades são as do momento e nenhum candidato é contraindicado",
    async (estado) => {
      const { run } = montar()
      const dados = await run({ estados: [estado] })

      expect(dados.qualidades).toEqual(qualidadesDoMomento({ estados: [estado] }, kb))
      expect(dados.candidatos.length, "candidatos no jantar").toBeGreaterThan(0)
      for (const c of dados.candidatos) {
        expect(contraindicacoesDo(c), c.id).not.toContain(estado)
        expect(c.adequacao, c.id).toBeGreaterThan(0)
      }
    },
  )

  it("com frio no jantar, o chá de gengibre entra e os dados seguem o schema", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })

    expect(dados.candidatos.map((c) => c.id)).toContain("cha-gengibre")
    expect(dadosDoPreparoSchema.safeParse(dados).success).toBe(true)
  })
})

describe("dor-de-cabeca: cada variante dá candidatos diferentes", () => {
  const variantes =
    kb.incomodos.find((i) => i.id === "dor-de-cabeca")?.variantes.map((v) => v.id) ?? []

  it("a base tem as três variantes", () => {
    expect(variantes).toHaveLength(3)
  })

  it("o conjunto de candidatos muda de uma variante para a outra", async () => {
    const { run } = montar()
    const assinaturas: string[] = []
    for (const variante of variantes) {
      const dados = await run({ incomodo: { id: "dor-de-cabeca", variante } })
      expect(dados.com_incomodo, variante).toBe(true)
      expect(dados.qualidades.precisa_variante, variante).toBeUndefined()
      assinaturas.push(
        dados.candidatos
          .map((c) => `${c.tipo}:${c.id}`)
          .sort()
          .join("|"),
      )
    }
    expect(new Set(assinaturas).size).toBe(variantes.length)
  })
})

describe("restrição, não como e não gosto tiram os itens certos", () => {
  it("restrição vegana tira alimentos não veganos e práticas com nunca_sugerir_se vegana", async () => {
    const { run, stores } = montar()
    await stores.profiles.definirRestricoes(CONTA, ["vegana"])
    const dados = await run({ estados: ["com_frio"] })

    for (const c of dados.candidatos) {
      for (const id of idsDoCandidato(c)) {
        expect(kb.alimento(id)?.restricoes ?? [], `${c.id} -> ${id}`).not.toContain("vegana")
      }
      const nuncaSugerir = c.tipo === "refeicao" ? [] : (kb.pratica(c.id)?.nunca_sugerir_se ?? [])
      expect(nuncaSugerir, c.id).not.toContain("vegana")
    }
  })

  it("controle: sem a restrição, sai algum candidato com alimento vegano restrito", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    const restritos = idsDosCandidatos(dados).filter((id) =>
      (kb.alimento(id)?.restricoes ?? []).includes("vegana"),
    )
    expect(restritos.length).toBeGreaterThan(0)
  })

  it("não como de alimento tira o alimento de todos os candidatos", async () => {
    const { run, stores } = montar()
    await stores.profiles.definirNaoCome(CONTA, [{ tipo: "alimento", valor: "gengibre" }])
    const dados = await run({ estados: ["com_frio"] })

    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
    expect(dados.fixos.nao_come).toEqual(["Gengibre"])
  })

  it("controle: sem o não como, o gengibre aparece nos candidatos", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    expect(idsDosCandidatos(dados)).toContain("gengibre")
  })

  it("não gosto de alimento tira o alimento; não gosto de prática tira a prática", async () => {
    const { run, stores } = montar()
    await stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "gengibre" }, "nao_gosta")
    await stores.preferences.definirGosto(
      CONTA,
      { tipo: "pratica", id: "cha-gengibre" },
      "nao_gosta",
    )
    const dados = await run({ estados: ["com_frio"] })

    expect(idsDosCandidatos(dados)).not.toContain("gengibre")
    expect(dados.candidatos.map((c) => c.id)).not.toContain("cha-gengibre")
  })

  it("controle: sem o não gosto, o chá de gengibre e o gengibre aparecem", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.candidatos.map((c) => c.id)).toContain("cha-gengibre")
    expect(idsDosCandidatos(dados)).toContain("gengibre")
  })
})
