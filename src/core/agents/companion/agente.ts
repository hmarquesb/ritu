import { acompanhanteV3 } from "@/core/agents/prompts/acompanhante.v3"
import { askUser } from "@/core/agents/tools/ask-user"
import { ayurvedaTools } from "@/core/agents/tools/ayurveda"
import { climaTools } from "@/core/agents/tools/clima"
import { finalizar } from "@/core/agents/tools/finalizar"
import { memoriaTools } from "@/core/agents/tools/memoria"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"

export function criarAcompanhante(): DefinicaoDoAgente {
  return {
    nome: "acompanhante",
    instrucoes: acompanhanteV3.instrucoes,
    prompt_versao: acompanhanteV3.versao,
    lembreteDeEntrega: acompanhanteV3.lembreteDeEntrega,
    tools: [...climaTools, ...memoriaTools, ...ayurvedaTools],
    controle: [finalizar as ToolDeControle<unknown>, askUser as ToolDeControle<unknown>],
  }
}
