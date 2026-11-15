import { describe, expect, it } from "vitest"
import { z } from "zod"
import { LlmError } from "@/core/llm/errors"
import { createFakeLlm } from "./fake-llm"

const schema = z.object({ titulo: z.string() })

describe("createFakeLlm", () => {
  it("devolve o dado validado pelo schema e os tokens fixos", async () => {
    const llm = createFakeLlm([{ titulo: "chá de gengibre" }])

    const resultado = await llm.gerar({ modelo: "modelo-a", instrucoes: "i", entrada: "e", schema })

    expect(resultado.dado).toEqual({ titulo: "chá de gengibre" })
    expect(resultado.tokens).toEqual({ entrada: 10, saida: 5 })
  })

  it("converte resposta roteirizada de erro em LlmError com o código", async () => {
    const llm = createFakeLlm([{ erro: "rate_limit" }])

    const chamada = llm.gerar({ modelo: "modelo-a", instrucoes: "i", entrada: "e", schema })

    await expect(chamada).rejects.toBeInstanceOf(LlmError)
    await expect(chamada).rejects.toMatchObject({ code: "rate_limit" })
  })

  it("dado fora do schema vira resposta_invalida", async () => {
    const llm = createFakeLlm([{ titulo: 42 }])

    await expect(
      llm.gerar({ modelo: "modelo-a", instrucoes: "i", entrada: "e", schema }),
    ).rejects.toMatchObject({
      code: "resposta_invalida",
    })
  })

  it("registra em pedidos a ordem, o modelo, as instruções e a entrada", async () => {
    const llm = createFakeLlm([{ titulo: "a" }, { titulo: "b" }])

    await llm.gerar({ modelo: "modelo-a", instrucoes: "i1", entrada: "e1", schema })
    await llm.gerar({ modelo: "modelo-b", instrucoes: "i2", entrada: "e2", schema })

    expect(llm.pedidos).toEqual([
      { modelo: "modelo-a", instrucoes: "i1", entrada: "e1" },
      { modelo: "modelo-b", instrucoes: "i2", entrada: "e2" },
    ])
  })

  it("lança Error quando acabam as respostas roteirizadas", async () => {
    const llm = createFakeLlm([])

    await expect(
      llm.gerar({ modelo: "modelo-a", instrucoes: "i", entrada: "e", schema }),
    ).rejects.toThrow(/acabaram as respostas/)
  })
})
