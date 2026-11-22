import { acompanhanteV8 } from "@/core/agents/prompts/acompanhante.v8"
import { askUser } from "@/core/agents/tools/ask-user"
import { ayurvedaTools } from "@/core/agents/tools/ayurveda"
import { climaTools } from "@/core/agents/tools/clima"
import { finalizar } from "@/core/agents/tools/finalizar"
import { memoriaTools } from "@/core/agents/tools/memoria"
import { listaPropor, memoriaPropor } from "@/core/agents/tools/propostas"
import { resultadoRegistrar } from "@/core/agents/tools/resultado"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import type { Tool } from "@/core/tools/tool"

export function criarAcompanhante(): DefinicaoDoAgente {
  return {
    nome: "acompanhante",
    instrucoes: acompanhanteV8.instrucoes,
    prompt_versao: acompanhanteV8.versao,
    lembreteDeEntrega: acompanhanteV8.lembreteDeEntrega,
    tools: [
      ...climaTools,
      ...memoriaTools,
      ...ayurvedaTools,
      memoriaPropor as Tool<unknown, unknown>,
      listaPropor as Tool<unknown, unknown>,
      resultadoRegistrar as Tool<unknown, unknown>,
    ],
    controle: [finalizar as ToolDeControle<unknown>, askUser as ToolDeControle<unknown>],
  }
}
