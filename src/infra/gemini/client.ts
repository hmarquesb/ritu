import { llmCotas } from "@config/index"
import { type GenerateContentParameters, GoogleGenAI } from "@google/genai"
import { z } from "zod"
import type { LlmClient } from "@/core/llm/client"
import { LlmError } from "@/core/llm/errors"

type Resposta = {
  text?: string
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

// Recorte do SDK que o adaptador usa; o teste injeta um falso.
export type GeminiSdk = {
  models: { generateContent(params: GenerateContentParameters): Promise<Resposta> }
}

function ehAborto(e: unknown): boolean {
  const nome = (e as { name?: unknown } | null)?.name
  return nome === "AbortError" || nome === "TimeoutError"
}

function mapearErro(e: unknown): LlmError {
  if (e instanceof LlmError) return e
  if (ehAborto(e)) return new LlmError("timeout", "A chamada ao modelo passou do tempo.")
  const status = (e as { status?: unknown } | null)?.status
  if (status === 429) return new LlmError("rate_limit", "O modelo recusou por limite de uso.")
  return new LlmError("indisponivel", "O modelo está indisponível.")
}

function lerJson<T>(texto: string | undefined, schema: z.ZodType<T>): T {
  const invalida = () => new LlmError("resposta_invalida", "A resposta do modelo é inválida.")
  if (texto === undefined) throw invalida()
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw invalida()
  }
  const lido = schema.safeParse(bruto)
  if (!lido.success) throw invalida()
  return lido.data
}

export function createGeminiClient(deps: { apiKey: () => string; sdk?: GeminiSdk }): LlmClient {
  let sdk = deps.sdk
  return {
    async gerar<T>(p: Parameters<LlmClient["gerar"]>[0] & { schema: z.ZodType<T> }) {
      sdk ??= new GoogleGenAI({ apiKey: deps.apiKey() })
      let resposta: Resposta
      try {
        resposta = await sdk.models.generateContent({
          model: p.modelo,
          contents: p.entrada,
          config: {
            systemInstruction: p.instrucoes,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(p.schema),
            abortSignal: AbortSignal.timeout(p.timeoutMs ?? llmCotas.timeoutMs),
          },
        })
      } catch (e) {
        throw mapearErro(e)
      }
      const uso = resposta.usageMetadata
      return {
        dado: lerJson(resposta.text, p.schema),
        tokens: { entrada: uso?.promptTokenCount ?? 0, saida: uso?.candidatesTokenCount ?? 0 },
      }
    },
  }
}
