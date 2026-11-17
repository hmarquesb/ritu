import type { z } from "zod"
import { interpreteV1 } from "@/core/agents/prompts/interprete.v1"
import { juizV1 } from "@/core/agents/prompts/juiz.v1"
import { memoriaV1 } from "@/core/agents/prompts/memoria.v1"
import type { LlmClient } from "@/core/llm/client"
import { LlmError } from "@/core/llm/errors"
import type { AgentRuntime, PedidoDePasso } from "@/core/runs/agent-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { loadDemoSeed } from "@/infra/knowledge/yaml-seed"
import { type Roteiro, roteirosDoE2e } from "../../../e2e/roteiros"

// Índice dos roteiros: a mensagem da pessoa, no texto exato, escolhe o roteiro. Sem roteiro, o modelo "fica fora do ar".
let indice: Map<string, Roteiro> | undefined

function roteiros(): Map<string, Roteiro> {
  indice ??= new Map(
    roteirosDoE2e(loadDemoSeed().mensagem_sugerida).map((r) => [r.mensagem, r] as const),
  )
  return indice
}

const MENSAGEM = /<mensagem_da_pessoa>\n([\s\S]*?)\n<\/mensagem_da_pessoa>/

function mensagemDe(texto: string): string | undefined {
  return MENSAGEM.exec(texto)?.[1]
}

export function roteiroDaMensagem(texto: string | undefined): Roteiro | undefined {
  return texto === undefined ? undefined : roteiros().get(texto)
}

const semModelo = () => new LlmError("indisponivel", "e2e: mensagem sem roteiro")

// Intérprete roteirizado pela mensagem; o Juiz aprova e a Memória devolve um resumo vazio.
export function createLlmDeRoteiros(): LlmClient {
  return {
    async gerar<T>(p: { instrucoes: string; entrada: string; schema: z.ZodType<T> }) {
      const tokens = { entrada: 10, saida: 5 }
      let dado: unknown
      if (p.instrucoes === interpreteV1.instrucoes) {
        dado = roteiroDaMensagem(mensagemDe(p.entrada))?.interpretacao
      } else if (p.instrucoes === juizV1.instrucoes) {
        dado = { apontamentos: [] }
      } else if (p.instrucoes === memoriaV1.instrucoes) {
        dado = { resumo: "" }
      }
      if (dado === undefined) throw semModelo()
      const validado = p.schema.safeParse(dado)
      if (!validado.success) throw new LlmError("resposta_invalida", "e2e: fora do schema")
      return { dado: validado.data, tokens }
    },
  }
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Acompanhante roteirizado: o roteiro vem da mensagem inicial do run e o passo, de quantas vezes o agente já falou.
// Assim a pausa e a retomada (que remontam as mensagens do checkpoint) seguem de onde pararam.
export function createRuntimeDeRoteiros(): AgentRuntime {
  return {
    async passo(pedido: PedidoDePasso) {
      const inicial = pedido.mensagens.find((m) => m.papel === "pessoa")
      const texto = inicial?.papel === "pessoa" ? mensagemDe(inicial.conteudo) : undefined
      const roteiro = roteiroDaMensagem(texto)
      if (!roteiro) throw semModelo()
      const indiceDoPasso = pedido.mensagens.filter((m) => m.papel === "agente").length
      const passo = roteiro.passos[indiceDoPasso]
      if (!passo) throw semModelo()
      if (passo.demoraMs) await esperar(passo.demoraMs)
      const { demoraMs: _demora, ...semDemora } = passo
      const r = await createScriptedRuntime([semDemora]).passo(pedido)
      // O runtime roteirizado numera as chamadas a cada instância: o passo entra no id para não repetir.
      return {
        ...r,
        chamadas: r.chamadas.map((c, i) => ({ ...c, id: `e${indiceDoPasso}-${i}` })),
      }
    },
  }
}
