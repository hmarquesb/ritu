import { describe, expect, it } from "vitest"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { listaEmPalavras, painelDoDosha } from "./painel"
import type { Perfil } from "./types"

const base = createMiniKnowledge()

function kbCom(parcial: Partial<KnowledgeBase>): KnowledgeBase {
  return { ...base, ...parcial }
}

function perfilCom(parcial: Partial<Perfil>): Perfil {
  return {
    conta_id: "conta-1",
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: "2026-11-01T00:00:00.000Z",
    ...parcial,
  }
}

describe("painelDoDosha: um dosha", () => {
  it("monta uma carta com o nome, o resumo, os blocos e as qualidades pelo vocabulário", () => {
    const painel = painelDoDosha(
      perfilCom({ prakriti: { vata: 1, pitta: 0, kapha: 0 }, origem: "declarado" }),
      base,
    )
    expect(painel.tem).toBe(true)
    if (!painel.tem) return
    expect(painel.nome).toBe("Vata")
    expect(painel.origem).toBe("declarado")
    expect(painel.proporcao).toBeNull()
    expect(painel.cartas).toHaveLength(1)
    const [carta] = painel.cartas
    expect(carta).toMatchObject({
      dosha: "vata",
      nome: "Vata",
      resumo: "Movimento, leveza e secura.",
      corpo: "Corpo leve e mãos frias.",
      mente: "Mente ágil.",
      digestao: "Irregular.",
      desequilibra: "Ansiedade e secura.",
      equilibra: "Calor, óleo e rotina.",
    })
    expect(carta?.qualidades).toEqual(["leve", "seco", "móvel", "frio", "áspero"])
  })

  it("traduz os elementos para palavras da tabela fixa", () => {
    const kb = kbCom({
      doshas: base.doshas.map((d) => (d.id === "vata" ? { ...d, elementos: ["ar", "espaco"] } : d)),
    })
    const painel = painelDoDosha(perfilCom({ prakriti: { vata: 1 }, origem: "declarado" }), kb)
    expect(painel.tem && painel.cartas[0]?.elementos).toEqual(["ar", "espaço"])
  })

  it("traduz água, fogo e terra com acento quando há", () => {
    const kb = kbCom({
      doshas: base.doshas.map((d) => ({ ...d, elementos: ["fogo", "agua", "terra"] })),
    })
    const painel = painelDoDosha(perfilCom({ prakriti: { pitta: 1 }, origem: "declarado" }), kb)
    expect(painel.tem && painel.cartas[0]?.elementos).toEqual(["fogo", "água", "terra"])
  })
})

describe("painelDoDosha: misto", () => {
  it("com origem quiz, traz as porcentagens inteiras que somam 100", () => {
    const painel = painelDoDosha(
      perfilCom({ prakriti: { vata: 0.6, pitta: 0.3, kapha: 0.1 }, origem: "quiz" }),
      base,
    )
    expect(painel.tem && painel.proporcao).toEqual([
      { dosha: "vata", porcento: 60 },
      { dosha: "pitta", porcento: 30 },
      { dosha: "kapha", porcento: 10 },
    ])
  })

  it("dá o resto ao maior resto e ordena do maior para o menor", () => {
    const painel = painelDoDosha(
      perfilCom({ prakriti: { kapha: 0.667, pitta: 0.222, vata: 0.111 }, origem: "quiz" }),
      base,
    )
    expect(painel.tem && painel.proporcao).toEqual([
      { dosha: "kapha", porcento: 67 },
      { dosha: "pitta", porcento: 22 },
      { dosha: "vata", porcento: 11 },
    ])
  })

  it("empate de um terço cada: o primeiro da ordem do nome leva o resto", () => {
    const painel = painelDoDosha(
      perfilCom({
        prakriti: { vata: 1 / 3, pitta: 1 / 3, kapha: 1 / 3 },
        origem: "quiz",
      }),
      base,
    )
    expect(painel.tem && painel.nome).toBe("Vata-Pitta")
    expect(painel.tem && painel.proporcao?.map((p) => p.porcento)).toEqual([34, 33, 33])
    expect(painel.tem && painel.cartas.map((c) => c.dosha)).toEqual(["vata", "pitta"])
  })

  it("com origem declarado, não traz proporção", () => {
    const painel = painelDoDosha(
      perfilCom({ prakriti: { vata: 0.5, pitta: 0.5 }, origem: "declarado" }),
      base,
    )
    expect(painel.tem).toBe(true)
    if (!painel.tem) return
    expect(painel.nome).toBe("Vata-Pitta")
    expect(painel.origem).toBe("declarado")
    expect(painel.proporcao).toBeNull()
    expect(painel.cartas.map((c) => c.nome)).toEqual(["Vata", "Pitta"])
  })
})

describe("painelDoDosha: sem dosha", () => {
  it("devolve uma linha por dosha, com nome e resumo", () => {
    const painel = painelDoDosha(perfilCom({ prakriti: null }), base)
    expect(painel).toEqual({
      tem: false,
      linhas: [
        { dosha: "vata", nome: "Vata", resumo: "Movimento, leveza e secura." },
        { dosha: "pitta", nome: "Pitta", resumo: "Calor, intensidade e transformação." },
        { dosha: "kapha", nome: "Kapha", resumo: "Estabilidade, peso e umidade." },
      ],
    })
  })
})

describe("listaEmPalavras", () => {
  it("une com vírgula e usa 'e' antes do último", () => {
    expect(listaEmPalavras(["ar", "espaço"])).toBe("ar e espaço")
    expect(listaEmPalavras(["a", "b", "c"])).toBe("a, b e c")
    expect(listaEmPalavras(["ar"])).toBe("ar")
    expect(listaEmPalavras([])).toBe("")
  })
})
