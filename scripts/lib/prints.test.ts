import { describe, expect, it } from "vitest"
import { codificarAteCaber, LIMITE_BYTES, qualidades } from "./prints"

const bytes = (tamanho: number) => new Uint8Array(tamanho)

describe("qualidades dos prints", () => {
  it("começa em 80 e desce de 5 em 5 até 5", () => {
    expect(qualidades()).toEqual([80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5])
  })

  it("o limite é 250 KB", () => {
    expect(LIMITE_BYTES).toBe(250_000)
  })
})

describe("codificarAteCaber", () => {
  it("fica com a primeira qualidade (80) quando já cabe", async () => {
    const achado = await codificarAteCaber(async () => bytes(100), 500)
    expect(achado?.qualidade).toBe(80)
    expect(achado?.bytes.byteLength).toBe(100)
  })

  it("desce de 5 em 5 até caber", async () => {
    // Tamanho = qualidade × 10: 80 a 55 estouram 500 bytes; 50 é o primeiro que cabe.
    const achado = await codificarAteCaber(async (q) => bytes(q * 10), 500)
    expect(achado?.qualidade).toBe(50)
    expect(achado?.bytes.byteLength).toBe(500)
  })

  it("aceita exatamente o limite", async () => {
    const achado = await codificarAteCaber(async () => bytes(LIMITE_BYTES))
    expect(achado?.qualidade).toBe(80)
  })

  it("devolve undefined quando nem a qualidade 5 cabe", async () => {
    let tentativas = 0
    const achado = await codificarAteCaber(async () => {
      tentativas++
      return bytes(10_000)
    }, 500)
    expect(achado).toBeUndefined()
    expect(tentativas).toBe(16)
  })
})
