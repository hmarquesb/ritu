import { describe, expect, it } from "vitest"
import {
  evitarSempreSchema,
  momentoSchema,
  naoComeSchema,
  prakritiSchema,
  sugestaoRegistradaSchema,
} from "./memory-schemas"

const momentoValido = {
  estados: ["sem_energia"],
  momento_do_dia: "manha",
  gunas_buscadas: ["quente"],
}

describe("momentoSchema", () => {
  it("aceita um momento com valores do vocabulário", () => {
    expect(momentoSchema.safeParse(momentoValido).success).toBe(true)
  })

  it("recusa um campo a mais, como incomodo", () => {
    expect(momentoSchema.safeParse({ ...momentoValido, incomodo: "dor" }).success).toBe(false)
  })

  it("recusa com_incomodo", () => {
    expect(momentoSchema.safeParse({ ...momentoValido, com_incomodo: true }).success).toBe(false)
  })

  it("recusa estado fora do vocabulário", () => {
    expect(momentoSchema.safeParse({ ...momentoValido, estados: ["inventado"] }).success).toBe(
      false,
    )
  })
})

describe("prakritiSchema", () => {
  it("aceita proporções que somam 1", () => {
    expect(prakritiSchema.safeParse({ vata: 0.5, pitta: 0.3, kapha: 0.2 }).success).toBe(true)
  })

  it("aceita soma dentro da folga de 0,01", () => {
    expect(prakritiSchema.safeParse({ vata: 0.5, pitta: 0.3, kapha: 0.205 }).success).toBe(true)
  })

  it("recusa uma soma de 0,8", () => {
    expect(prakritiSchema.safeParse({ vata: 0.5, pitta: 0.2, kapha: 0.1 }).success).toBe(false)
  })

  it("recusa valor fora de 0 a 1", () => {
    expect(prakritiSchema.safeParse({ vata: 1.5, pitta: -0.5, kapha: 0 }).success).toBe(false)
  })
})

describe("sugestaoRegistradaSchema", () => {
  it("aceita uma sugestão de chá com alimentos e título", () => {
    const sugestao = { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" }

    expect(sugestaoRegistradaSchema.safeParse(sugestao).success).toBe(true)
  })

  it("recusa um tipo fora da lista", () => {
    const sugestao = { tipo: "sobremesa", alimentos: [], titulo: "x" }

    expect(sugestaoRegistradaSchema.safeParse(sugestao).success).toBe(false)
  })
})

describe("evitarSempreSchema e naoComeSchema", () => {
  it("evitarSempre exige tipo, valor e desde", () => {
    const ok = [{ tipo: "grupo", valor: "laticinios", desde: "2026-01-01" }]

    expect(evitarSempreSchema.safeParse(ok).success).toBe(true)
    expect(evitarSempreSchema.safeParse([{ tipo: "grupo", valor: "laticinios" }]).success).toBe(
      false,
    )
  })

  it("naoCome aceita alimento e texto livre", () => {
    const itens = [
      { tipo: "alimento", valor: "cebola" },
      { tipo: "texto", valor: "pimenta forte" },
    ]

    expect(naoComeSchema.safeParse(itens).success).toBe(true)
  })
})
