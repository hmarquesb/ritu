import { describe, expect, it } from "vitest"
import { LlmError } from "@/core/llm/errors"
import { createFixedModel } from "./fixed-model"

describe("createFixedModel", () => {
  it("devolve o primeiro modelo por padrão e acumula os usos", async () => {
    const fornecedor = createFixedModel()

    expect(await fornecedor.proximo()).toEqual({ modelo: "modelo-a" })

    await fornecedor.usou("modelo-a", { entrada: 100, saida: 20 })
    await fornecedor.usou("modelo-a", { entrada: 5, saida: 1 })

    expect(fornecedor.usos).toEqual([
      { modelo: "modelo-a", tokens: { entrada: 100, saida: 20 } },
      { modelo: "modelo-a", tokens: { entrada: 5, saida: 1 } },
    ])
  })

  it("troca de modelo depois de rate_limit e informa a troca uma vez", async () => {
    const fornecedor = createFixedModel(["modelo-a", "modelo-b"])

    await fornecedor.falhou("modelo-a", new LlmError("rate_limit", "429"))

    expect(fornecedor.falhas).toHaveLength(1)
    expect(await fornecedor.proximo()).toEqual({
      modelo: "modelo-b",
      troca: { de: "modelo-a", motivo: "429" },
    })
    expect(await fornecedor.proximo()).toEqual({ modelo: "modelo-b" })
  })

  it("não troca de modelo em erros que não são rate_limit", async () => {
    const fornecedor = createFixedModel(["modelo-a", "modelo-b"])

    await fornecedor.falhou("modelo-a", new LlmError("timeout", "demorou"))

    expect(fornecedor.falhas).toHaveLength(1)
    expect(await fornecedor.proximo()).toEqual({ modelo: "modelo-a" })
  })

  it("devolve null quando não há próximo modelo", async () => {
    const fornecedor = createFixedModel(["modelo-a"])

    await fornecedor.falhou("modelo-a", new LlmError("rate_limit", "429"))

    expect(await fornecedor.proximo()).toBeNull()
  })
})
