import { Agent } from "@mastra/core/agent"
import { noopLogger } from "@mastra/core/logger"
import { createTool } from "@mastra/core/tools"
import { LlmError } from "@/core/llm/errors"
import type {
  AgentRuntime,
  MensagemDoLoop,
  PedidoDePasso,
  ResultadoDePasso,
} from "@/core/runs/agent-runtime"

type ModeloDaBiblioteca = ConstructorParameters<typeof Agent>[0]["model"]
type MensagemDaBiblioteca = { role: string; content: unknown }

export type DepsDoRuntimeMastra = {
  apiKey: () => string
  /** Só para teste: troca o modelo resolvido pelo roteador da biblioteca. */
  modeloDe?: (modelo: string, apiKey: string) => ModeloDaBiblioteca
}

// A captura de entrada e saída pelo exporter de observabilidade fica desligada: texto da pessoa não vai para o rastro.
export const OPCOES_DE_TRACE = { hideInput: true, hideOutput: true } as const

function modeloPadrao(modelo: string, apiKey: string): ModeloDaBiblioteca {
  const id = modelo.includes("/") ? modelo : `google/${modelo}`
  return { id: id as `${string}/${string}`, apiKey }
}

function paraMensagem(mensagem: MensagemDoLoop): MensagemDaBiblioteca {
  switch (mensagem.papel) {
    case "pessoa":
      return { role: "user", content: mensagem.conteudo }
    case "sistema":
      // Lembretes do loop entram como mensagem de pessoa: nem toda API aceita "system" no meio da conversa.
      return { role: "user", content: mensagem.conteudo }
    case "agente":
      return {
        role: "assistant",
        content: [
          ...(mensagem.texto ? [{ type: "text", text: mensagem.texto }] : []),
          ...mensagem.chamadas.map((c) => ({
            type: "tool-call",
            toolCallId: c.id,
            toolName: c.nome,
            input: c.argumentos,
          })),
        ],
      }
    case "tool":
      return {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: mensagem.chamada_id,
            toolName: mensagem.nome,
            output: { type: "json", value: mensagem.resultado ?? null },
          },
        ],
      }
  }
}

// Declaração sem `execute`: a biblioteca para no passo em que o modelo chama a tool. Quem executa é o loop.
function declararTools(tools: PedidoDePasso["tools"]) {
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      createTool({ id: t.name, description: t.description, inputSchema: t.input as never }),
    ]),
  )
}

function statusDe(erro: unknown): number | undefined {
  const e = erro as { statusCode?: unknown; status?: unknown; cause?: unknown } | null
  if (!e || typeof e !== "object") return undefined
  if (typeof e.statusCode === "number") return e.statusCode
  if (typeof e.status === "number") return e.status
  return e.cause ? statusDe(e.cause) : undefined
}

function ehAborto(erro: unknown): boolean {
  const e = erro as { name?: string; cause?: unknown; message?: string } | null
  if (!e || typeof e !== "object") return false
  if (e.name === "AbortError" || e.name === "TimeoutError" || e.name === "MastraTimeoutError")
    return true
  return e.cause ? ehAborto(e.cause) : false
}

function traduzirErro(erro: unknown, abortou: boolean): LlmError {
  if (erro instanceof LlmError) return erro
  if (abortou || ehAborto(erro)) return new LlmError("timeout", "Tempo do passo esgotado")
  const status = statusDe(erro)
  if (status === 429) return new LlmError("rate_limit", "Cota do modelo esgotada")
  if (status !== undefined && status >= 500) {
    return new LlmError("indisponivel", "Modelo indisponível")
  }
  const falha = new LlmError("indisponivel", "Falha ao chamar o modelo")
  // Só o nome da classe, nunca a mensagem: ela pode trazer texto da pessoa.
  falha.cause = new Error(erro instanceof Error ? erro.constructor.name : typeof erro)
  return falha
}

type ChamadaDaBiblioteca = { payload: { toolCallId: string; toolName: string; args: unknown } }

function montarResultado(saida: {
  text?: string
  toolCalls?: ChamadaDaBiblioteca[]
  usage?: { inputTokens?: number; outputTokens?: number }
}): ResultadoDePasso {
  const chamadas = (saida.toolCalls ?? []).map((c) => ({
    id: c.payload.toolCallId,
    nome: c.payload.toolName,
    argumentos: c.payload.args,
  }))
  const texto = saida.text?.trim() ? saida.text : undefined
  if (!texto && chamadas.length === 0) {
    throw new LlmError("resposta_invalida", "Resposta sem texto nem chamada de tool")
  }
  return {
    ...(texto ? { texto } : {}),
    chamadas,
    tokens_entrada: saida.usage?.inputTokens ?? 0,
    tokens_saida: saida.usage?.outputTokens ?? 0,
  }
}

/** Runtime do loop: exatamente uma chamada de modelo por passo, sem executar tool, sem memória e sem nova tentativa. */
export function createMastraRuntime(deps: DepsDoRuntimeMastra): AgentRuntime {
  const resolverModelo = deps.modeloDe ?? modeloPadrao
  return {
    async passo(p: PedidoDePasso): Promise<ResultadoDePasso> {
      const controle = new AbortController()
      let abortou = false
      const relogio = setTimeout(() => {
        abortou = true
        controle.abort()
      }, p.timeoutMs)
      try {
        const agente = new Agent({
          id: "ritu",
          name: "ritu",
          instructions: p.instrucoes,
          model: resolverModelo(p.modelo, deps.apiKey()),
          tools: declararTools(p.tools),
        })
        // O logger padrão imprime o erro do provedor, que carrega o prompt: fica mudo.
        agente.__registerPrimitives({ logger: noopLogger })
        const saida = await agente.generate(p.mensagens.map(paraMensagem) as never, {
          maxSteps: 1,
          abortSignal: controle.signal,
          modelSettings: { maxRetries: 0 },
          tracingOptions: OPCOES_DE_TRACE,
        })
        // A biblioteca engole o aborto e devolve uma saída vazia: o relógio do passo é a fonte da verdade.
        if (abortou) throw new LlmError("timeout", "Tempo do passo esgotado")
        return montarResultado(saida as never)
      } catch (erro) {
        throw traduzirErro(erro, abortou)
      } finally {
        clearTimeout(relogio)
      }
    },
  }
}
