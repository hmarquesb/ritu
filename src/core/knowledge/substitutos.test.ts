import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { filtroVazio } from "./filtros"
import type { Alimento } from "./schemas"
import { fraseDaTroca, type SinaisPessoa, sinaisVazios, substitutos } from "./substitutos"
import type { Guna } from "./vocab"

const kb = createMiniKnowledge()

type Parametros = Parameters<typeof substitutos>[0]

const padrao: Omit<Parametros, "alimento_id"> = {
  outros_itens: [],
  filtro: filtroVazio,
  sinais: sinaisVazios,
  limite: 10,
}

function ids(parcial: Partial<Parametros> & Pick<Parametros, "alimento_id">): string[] {
  return substitutos({ ...padrao, ...parcial }, kb).map((s) => s.alimento_id)
}

function alimento(id: string): Alimento {
  const a = kb.alimento(id)
  if (!a) throw new Error(`alimento ${id} ausente na mini-base`)
  return a
}

const com = (parcial: Partial<SinaisPessoa>): SinaisPessoa => ({ ...sinaisVazios, ...parcial })

describe("substitutos", () => {
  it("de canela (tempero) o primeiro é cardamomo: quente, tempero e mais gunas em comum", () => {
    const [primeiro] = substitutos({ ...padrao, alimento_id: "canela", funcao: "tempero" }, kb)
    expect(primeiro?.alimento_id).toBe("cardamomo")
    expect(alimento("cardamomo").gunas).toContain("quente")
    expect(alimento("cardamomo").funcoes).toContain("tempero")
  })

  it("cardamomo vem antes de gengibre por ter mais gunas em comum com canela", () => {
    expect(ids({ alimento_id: "canela", funcao: "tempero" })).toEqual(["cardamomo", "gengibre"])
  })

  it("nunca devolve o próprio alimento", () => {
    expect(ids({ alimento_id: "canela", funcao: "tempero" })).not.toContain("canela")
  })

  it("alimento em nao_gosta some da lista", () => {
    const filtro = { ...filtroVazio, nao_gosta: ["cardamomo"] }
    expect(ids({ alimento_id: "canela", funcao: "tempero", filtro })).toEqual(["gengibre"])
  })

  it("filtro que elimina todos os candidatos devolve lista vazia", () => {
    const filtro = { ...filtroVazio, nao_come: ["cardamomo", "gengibre"] }
    expect(ids({ alimento_id: "canela", funcao: "tempero", filtro })).toEqual([])
  })

  it("limite corta a lista", () => {
    expect(ids({ alimento_id: "canela", funcao: "tempero", limite: 1 })).toEqual(["cardamomo"])
  })

  it("alimento inexistente devolve lista vazia", () => {
    expect(ids({ alimento_id: "nao-existe", funcao: "tempero" })).toEqual([])
  })

  it("sem função, usa o mesmo grupo do alimento", () => {
    expect(ids({ alimento_id: "canela" })).toEqual(["cardamomo", "gengibre"])
  })

  it("desempate: está em casa sobe, depois gosta, depois ajudou, depois nome", () => {
    // Gengibre e canela empatam em gunas em comum com cardamomo? Aqui a base é gengibre:
    // canela e cardamomo empatam com 1 guna em comum (quente).
    const base = { alimento_id: "gengibre", funcao: "tempero" as const }
    expect(ids({ ...base, sinais: com({ em_casa: ["cardamomo"] }) })).toEqual([
      "cardamomo",
      "canela",
    ])
    expect(ids({ ...base, sinais: com({ gosta: ["canela"] }) })).toEqual(["canela", "cardamomo"])
    expect(ids({ ...base, sinais: com({ ajudou: { cardamomo: 2 } }) })).toEqual([
      "cardamomo",
      "canela",
    ])
    expect(ids(base)).toEqual(["canela", "cardamomo"])
  })

  it("outros_itens com banana tira leite, que conflita com ela", () => {
    const base = { alimento_id: "ghee", funcao: "liquido" as const }
    expect(ids(base)).toEqual(["leite"])
    expect(ids({ ...base, outros_itens: ["banana"] })).toEqual([])
  })

  it("com preparo, usa a vaga da função e os grupos dela", () => {
    const r = ids({ alimento_id: "abobora", funcao: "base", preparo_id: "pure-de-raiz" })
    expect(r).toEqual(["batata-doce", "cenoura"])
  })

  it("com preparo que não tem a função, devolve lista vazia", () => {
    expect(ids({ alimento_id: "abobora", funcao: "proteina", preparo_id: "pure-de-raiz" })).toEqual(
      [],
    )
  })

  it("o motivo usa a frase da troca com as gunas em comum", () => {
    const [primeiro] = substitutos({ ...padrao, alimento_id: "canela", funcao: "tempero" }, kb)
    expect(primeiro).toEqual({
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      em_comum: ["quente", "leve"],
      em_casa: false,
      motivo: "Troquei canela por cardamomo: os dois aquecem e aliviam o peso.",
      linha_base: "alimentos:cardamomo",
    })
  })

  it("em_casa marca os alimentos que a pessoa tem", () => {
    const [primeiro] = substitutos(
      {
        ...padrao,
        alimento_id: "canela",
        funcao: "tempero",
        sinais: com({ em_casa: ["cardamomo"] }),
      },
      kb,
    )
    expect(primeiro?.em_casa).toBe(true)
  })
})

describe("fraseDaTroca", () => {
  const canela = alimento("canela")
  const cardamomo = alimento("cardamomo")

  it("usa o verbo plural da guna em comum", () => {
    expect(fraseDaTroca(canela, cardamomo, ["quente"], kb)).toBe(
      "Troquei canela por cardamomo: os dois aquecem.",
    )
  })

  it("com duas gunas em comum, junta até dois verbos com e", () => {
    expect(fraseDaTroca(canela, cardamomo, ["quente", "leve"], kb)).toBe(
      "Troquei canela por cardamomo: os dois aquecem e aliviam o peso.",
    )
  })

  it("com três gunas em comum, usa só os dois primeiros verbos", () => {
    const frase = fraseDaTroca(canela, cardamomo, ["quente", "frio", "pesado"], kb)
    expect(frase).toBe("Troquei canela por cardamomo: os dois aquecem e refrescam.")
  })

  it("sem verbo em comum, usa a frase da função", () => {
    expect(fraseDaTroca(canela, cardamomo, ["aspero"], kb)).toBe(
      "Troquei canela por cardamomo: têm a mesma função no preparo.",
    )
    expect(fraseDaTroca(canela, cardamomo, [], kb)).toBe(
      "Troquei canela por cardamomo: têm a mesma função no preparo.",
    )
  })

  it("pluraliza cada um dos 11 verbos da base", () => {
    const esperado: [Guna, string][] = [
      ["quente", "aquecem"],
      ["frio", "refrescam"],
      ["pesado", "nutrem"],
      ["leve", "aliviam o peso"],
      ["oleoso", "umedecem"],
      ["seco", "secam"],
      ["estavel", "assentam"],
      ["movel", "estimulam"],
      ["suave", "suavizam"],
      ["brando", "acalmam"],
      ["intenso", "despertam"],
    ]
    for (const [guna, plural] of esperado) {
      expect(fraseDaTroca(canela, cardamomo, [guna], kb)).toBe(
        `Troquei canela por cardamomo: os dois ${plural}.`,
      )
    }
  })
})

describe("valores vazios congelados", () => {
  it("filtroVazio e as listas dentro dele não mudam", () => {
    expect(Object.isFrozen(filtroVazio)).toBe(true)
    expect(Object.isFrozen(filtroVazio.evitar)).toBe(true)
    expect(Object.isFrozen(filtroVazio.restricoes)).toBe(true)
    expect(Object.isFrozen(filtroVazio.nao_come)).toBe(true)
    expect(Object.isFrozen(filtroVazio.nao_gosta)).toBe(true)
    expect(() => filtroVazio.nao_come.push("x")).toThrow()
  })

  it("sinaisVazios e as listas dentro dele não mudam", () => {
    expect(Object.isFrozen(sinaisVazios)).toBe(true)
    expect(Object.isFrozen(sinaisVazios.em_casa)).toBe(true)
    expect(Object.isFrozen(sinaisVazios.gosta)).toBe(true)
    expect(Object.isFrozen(sinaisVazios.ajudou)).toBe(true)
    expect(() => sinaisVazios.em_casa.push("x")).toThrow()
  })
})
