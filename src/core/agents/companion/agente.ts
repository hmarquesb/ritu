import { acompanhanteV2 } from "@/core/agents/prompts/acompanhante.v2"
import { ayurvedaTools } from "@/core/agents/tools/ayurveda"
import { climaTools } from "@/core/agents/tools/clima"
import { finalizar } from "@/core/agents/tools/finalizar"
import { memoriaTools } from "@/core/agents/tools/memoria"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"

export function criarAcompanhante(): DefinicaoDoAgente {
  return {
    nome: "acompanhante",
    instrucoes: acompanhanteV2.instrucoes,
    prompt_versao: acompanhanteV2.versao,
    lembreteDeEntrega: acompanhanteV2.lembreteDeEntrega,
    tools: [...climaTools, ...memoriaTools, ...ayurvedaTools],
    controle: [finalizar as ToolDeControle<unknown>],
  }
}
