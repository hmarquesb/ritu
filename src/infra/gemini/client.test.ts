import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { LlmError } from "@/core/llm/errors"
import { createGeminiClient, type GeminiSdk } from "./client"

const schema = z.object({ ok: z.boolean() })
const pedido = { modelo: "modelo-a", instrucoes: "sistema", entrada: "oi", schema }

function sdkCom(generate: GeminiSdk["models"]["generateContent"]): GeminiSdk {
  return { models: { generateContent: generate } }
}

async function codigo(sdk: GeminiSdk): Promise<string | undefined> {
  const client = createGeminiClient({ apiKey: () => "k", sdk })
  try {
    await client.gerar(pedido)
  } catch (e) {
    return e instanceof LlmError ? e.code : "outro"
  }
  return undefined
}

describe("createGeminiClient", () => {
  it("devolve o dado validado e os tokens", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
    })
    const client = createGeminiClient({ apiKey: () => "k", sdk: sdkCom(generate) })

    const r = await client.gerar(pedido)

    expect(r).toEqual({ dado: { ok: true }, tokens: { entrada: 7, saida: 3 } })
    const arg = generate.mock.calls[0]?.[0]
    expect(arg?.model).toBe("modelo-a")
    expect(arg?.contents).toBe("oi")
    expect(arg?.config?.systemInstruction).toBe("sistema")
    expect(arg?.config?.responseMimeType).toBe("application/json")
  })

  it("tokens ausentes valem 0", async () => {
    const client = createGeminiClient({
      apiKey: () => "k",
      sdk: sdkCom(async () => ({ text: '{"ok":false}' })),
    })

    expect((await client.gerar(pedido)).tokens).toEqual({ entrada: 0, saida: 0 })
  })

  it("mapeia os status e o aborto", async () => {
    const comStatus = (status: number) =>
      sdkCom(async () => {
        throw Object.assign(new Error("x"), { status })
      })
    expect(await codigo(comStatus(429))).toBe("rate_limit")
    expect(await codigo(comStatus(503))).toBe("indisponivel")
    expect(await codigo(comStatus(400))).toBe("indisponivel")
    expect(
      await codigo(
        sdkCom(async () => {
          throw new DOMException("abortado", "AbortError")
        }),
      ),
    ).toBe("timeout")
    expect(
      await codigo(
        sdkCom(async () => {
          throw new TypeError("fetch failed")
        }),
      ),
    ).toBe("indisponivel")
  })

  it("JSON inválido ou fora do schema vira resposta_invalida", async () => {
    expect(await codigo(sdkCom(async () => ({ text: "não é json" })))).toBe("resposta_invalida")
    expect(await codigo(sdkCom(async () => ({ text: '{"ok":"sim"}' })))).toBe("resposta_invalida")
    expect(await codigo(sdkCom(async () => ({})))).toBe("resposta_invalida")
  })

  it("criar o cliente não lê a chave", () => {
    const apiKey = vi.fn(() => "k")

    createGeminiClient({ apiKey })

    expect(apiKey).not.toHaveBeenCalled()
  })
})
