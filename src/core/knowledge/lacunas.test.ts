import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { juntarNomes, passosDoPreparo, preencherLacunas, tituloDoPreparo } from "./lacunas"
import type { Preparo } from "./schemas"

describe("preencherLacunas", () => {
  it("preenche os nomes da tabela da spec, exatamente", () => {
    expect(
      preencherLacunas("Arroz bem cozido com {legume} e {gordura}", {
        legume: ["abóbora"],
        gordura: ["ghee"],
      }),
    ).toBe("Arroz bem cozido com abóbora e ghee")

    expect(
      preencherLacunas("Arroz bem cozido com {legume} e {gordura}", { legume: ["abóbora"] }),
    ).toBe("Arroz bem cozido com abóbora")

    expect(
      preencherLacunas("Juntar {legume}. Finalizar com {gordura} e {tempero}.", {
        legume: ["abóbora"],
        tempero: ["gengibre"],
      }),
    ).toBe("Juntar abóbora. Finalizar com gengibre.")

    expect(
      preencherLacunas("Juntar {legume}. Finalizar com {gordura} e {tempero}.", {
        legume: ["abóbora"],
      }),
    ).toBe("Juntar abóbora.")

    expect(preencherLacunas("Sopa de {legume}", { legume: ["abóbora", "cenoura", "chuchu"] })).toBe(
      "Sopa de abóbora, cenoura e chuchu",
    )
  })

  it("usa o conector que vem antes quando não há conector depois", () => {
    expect(preencherLacunas("Cozinhe {base} e {legume}.", { base: ["arroz"] })).toBe(
      "Cozinhe arroz.",
    )
  })

  it("usa a palavra anterior quando não há conector nem antes nem depois", () => {
    expect(preencherLacunas("Mingau de {base} com {liquido}", { liquido: ["leite"] })).toBe(
      "Mingau com leite",
    )
  })

  it("colapsa espaços duplos e põe maiúscula na primeira letra", () => {
    expect(preencherLacunas("arroz  com   {legume}", { legume: ["abóbora"] })).toBe(
      "Arroz com abóbora",
    )
  })

  it("não mexe em texto sem lacuna além de colapsar espaços e maiúscula", () => {
    expect(preencherLacunas("cozinhe  devagar.", {})).toBe("Cozinhe devagar.")
  })
})

describe("tituloDoPreparo e passosDoPreparo", () => {
  const kb = createMiniKnowledge()
  const leiteMorno = kb.preparo("leite-morno-com-especiaria") as Preparo
  const arroz = kb.preparo("arroz-com-legume") as Preparo

  it("tituloDoPreparo usa os nomes dos alimentos agrupados por função, na ordem dos itens", () => {
    const itens = [
      { alimento_id: "canela", funcao: "tempero" as const },
      { alimento_id: "cardamomo", funcao: "tempero" as const },
    ]
    expect(tituloDoPreparo(leiteMorno, itens, kb)).toBe("Leite morno com canela e cardamomo")
  })

  it("passosDoPreparo tira a frase que ficou sem nenhum nome", () => {
    const itens = [
      { alimento_id: "ghee", funcao: "gordura" as const },
      { alimento_id: "canela", funcao: "tempero" as const },
    ]
    expect(passosDoPreparo(arroz, itens, kb)).toBe("Finalize com ghee e, se quiser, canela.")
  })
})

describe("juntarNomes", () => {
  it("devolve um nome só, em minúsculas", () => {
    expect(juntarNomes(["Abóbora"])).toBe("abóbora")
  })

  it("junta dois nomes com e", () => {
    expect(juntarNomes(["Abóbora", "Ghee"])).toBe("abóbora e ghee")
  })

  it("junta três nomes com vírgula e e", () => {
    expect(juntarNomes(["Abóbora", "Cenoura", "Chuchu"])).toBe("abóbora, cenoura e chuchu")
  })
})
