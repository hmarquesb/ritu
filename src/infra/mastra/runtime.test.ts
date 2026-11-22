import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { RituError } from "@/core/errors"
import { LlmError } from "@/core/llm/errors"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { createMastraRuntime, OPCOES_DE_TRACE } from "./runtime"

type Parte = Record<string, unknown>

// Modelo falso no formato V2 da biblioteca: devolve o conteúdo do roteiro, sem rede.
function modeloFalso(partes: Parte[] | Error, chamadas: unknown[] = []) {
  return {
    specificationVersion: "v2" as const,
    provider: "falso",
    modelId: "falso-1",
    supportedUrls: {},
    async doGenerate(opcoes: unknown) {
      chamadas.push(opcoes)
      if (partes instanceof Error) throw partes
      const temTool = partes.some((p) => p.type === "tool-call")
      return {
        content: partes,
        finishReason: temTool ? "tool-calls" : "stop",
        usage: USO,
        warnings: [],
      }
    },
    async doStream(opcoes: unknown) {
      chamadas.push(opcoes)
      throw new Error("doStream não é usado")
    },
  }
}

const USO = { inputTokens: 12, outputTokens: 5, totalTokens: 17 }

function partesDeTool(): Parte[] {
  return [{ type: "tool-call", toolCallId: "c1", toolName: "hora_atual", input: "{}" }]
}

function pedido(sobrescrever: Partial<PedidoDePasso> = {}): PedidoDePasso {
  return {
    instrucoes: "Você é o Ritu.",
    mensagens: [{ papel: "pessoa", conteudo: "Que horas são?" }],
    tools: [{ name: "hora_atual", description: "Hora atual", input: z.object({}) }],
    modelo: "falso/falso-1",
    timeoutMs: 5000,
    ...sobrescrever,
  }
}

function runtimeCom(modelo: unknown) {
  return createMastraRuntime({
    apiKey: () => "chave",
    modeloDe: () => modelo as never,
  })
}

describe("createMastraRuntime", () => {
  it("um passo com chamada de tool devolve nome e argumentos, sem executar a tool", async () => {
    const chamadas: unknown[] = []
    const resultado = await runtimeCom(modeloFalso(partesDeTool(), chamadas)).passo(pedido())
    expect(resultado.chamadas).toEqual([{ id: "c1", nome: "hora_atual", argumentos: {} }])
    expect(chamadas).toHaveLength(1)
  })

  it("nomes com ponto vão ao modelo com _ e voltam com o nome original", async () => {
    const chamadas: { tools?: { name: string }[]; prompt: unknown[] }[] = []
    const partes = [
      { type: "tool-call", toolCallId: "c1", toolName: "ayurveda_checar_combinacao", input: "{}" },
    ]
    const resultado = await runtimeCom(modeloFalso(partes, chamadas)).passo(
      pedido({
        tools: [
          { name: "ayurveda.checar_combinacao", description: "x", input: z.object({}) },
          { name: "clima.agora", description: "y", input: z.object({}) },
        ],
        mensagens: [
          { papel: "pessoa", conteudo: "oi" },
          { papel: "agente", chamadas: [{ id: "h1", nome: "clima.agora", argumentos: {} }] },
          { papel: "tool", chamada_id: "h1", nome: "clima.agora", resultado: { status: "ok" } },
        ],
      }),
    )
    expect(resultado.chamadas[0]?.nome).toBe("ayurveda.checar_combinacao")
    const nomes = chamadas[0]?.tools?.map((t) => t.name)
    expect(nomes).toEqual(["ayurveda_checar_combinacao", "clima_agora"])
    expect(JSON.stringify(chamadas[0]?.prompt)).not.toContain("clima.agora")
  })

  it("duas tools que viram o mesmo nome codificado falham alto, com os dois nomes", async () => {
    const erro = await runtimeCom(modeloFalso(partesDeTool()))
      .passo(
        pedido({
          tools: [
            { name: "a.b", description: "x", input: z.object({}) },
            { name: "a_b", description: "y", input: z.object({}) },
          ],
        }),
      )
      .catch((e) => e)
    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("tool_nome_colide")
    expect(erro.message).toContain("a.b")
    expect(erro.message).toContain("a_b")
  })

  it("devolve os tokens do provedor", async () => {
    const resultado = await runtimeCom(modeloFalso(partesDeTool())).passo(pedido())
    expect(resultado.tokens_entrada).toBe(12)
    expect(resultado.tokens_saida).toBe(5)
  })

  it("devolve o texto quando o modelo só responde texto", async () => {
    const resultado = await runtimeCom(
      modeloFalso([{ type: "text", text: "São três horas." }]),
    ).passo(pedido())
    expect(resultado.texto).toBe("São três horas.")
    expect(resultado.chamadas).toEqual([])
  })

  it("converte o histórico com tool para as mensagens da biblioteca", async () => {
    const chamadas: { prompt: unknown[] }[] = []
    await runtimeCom(modeloFalso([{ type: "text", text: "ok" }], chamadas)).passo(
      pedido({
        mensagens: [
          { papel: "pessoa", conteudo: "oi" },
          { papel: "agente", chamadas: [{ id: "c1", nome: "hora_atual", argumentos: {} }] },
          { papel: "tool", chamada_id: "c1", nome: "hora_atual", resultado: { hora: "15:00" } },
          { papel: "sistema", conteudo: "lembrete" },
        ],
      }),
    )
    const papeis = chamadas[0]?.prompt.map((m) => (m as { role: string }).role)
    expect(papeis).toContain("assistant")
    expect(papeis).toContain("tool")
  })

  it("429 vira rate_limit", async () => {
    const erro = Object.assign(new Error("quota"), { statusCode: 429 })
    await expect(runtimeCom(modeloFalso(erro)).passo(pedido())).rejects.toMatchObject({
      name: "LlmError",
      code: "rate_limit",
    })
  })

  it("5xx vira indisponivel", async () => {
    const erro = Object.assign(new Error("fora"), { statusCode: 503 })
    await expect(runtimeCom(modeloFalso(erro)).passo(pedido())).rejects.toMatchObject({
      code: "indisponivel",
    })
  })

  it("o aborto por timeout vira timeout", async () => {
    const modelo = modeloFalso([])
    modelo.doGenerate = async (opcoes: unknown) => {
      const sinal = (opcoes as { abortSignal?: AbortSignal }).abortSignal
      await new Promise((_, rejeitar) => {
        sinal?.addEventListener("abort", () => rejeitar(sinal.reason ?? new Error("abort")))
      })
      throw new Error("inalcançável")
    }
    const erro = await runtimeCom(modelo)
      .passo(pedido({ timeoutMs: 30 }))
      .catch((e) => e)
    expect(erro).toBeInstanceOf(LlmError)
    expect(erro.code).toBe("timeout")
  })

  it("resposta sem texto nem chamada vira resposta_invalida", async () => {
    await expect(runtimeCom(modeloFalso([])).passo(pedido())).rejects.toMatchObject({
      code: "resposta_invalida",
    })
  })

  it("a captura de entrada e saída pelo exporter está desligada", () => {
    expect(OPCOES_DE_TRACE).toMatchObject({ hideInput: true, hideOutput: true })
  })

  it("não lê a chave ao criar o runtime", () => {
    const apiKey = vi.fn(() => "chave")
    createMastraRuntime({ apiKey })
    expect(apiKey).not.toHaveBeenCalled()
  })

  it("um 429 não escreve nada em console nem em stderr", async () => {
    const saidas: string[] = []
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a) => void saidas.push(a.join(" "))),
    )
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((c: unknown) => !saidas.push(String(c)))
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((c: unknown) => !saidas.push(String(c)))
    try {
      const erro = Object.assign(new Error("texto da pessoa"), { statusCode: 429 })
      await runtimeCom(modeloFalso(erro))
        .passo(pedido())
        .catch(() => undefined)
    } finally {
      for (const e of [...espioes, stderr, stdout]) e.mockRestore()
    }
    expect(saidas).toEqual([])
  })

  it("a rota m@2 resolve o modelo m com a chave 2", async () => {
    const vistos: [string, string][] = []
    const runtime = createMastraRuntime({
      apiKey: (n) => `chave${n}`,
      modeloDe: (modelo, apiKey) => {
        vistos.push([modelo, apiKey])
        return modeloFalso(partesDeTool(), []) as never
      },
    })
    await runtime.passo(pedido({ modelo: "m@2" }))
    expect(vistos).toEqual([["m", "chave2"]])
  })
})
