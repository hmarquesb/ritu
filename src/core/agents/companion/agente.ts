import { acompanhanteV1 } from "@/core/agents/prompts/acompanhante.v1"
import { ayurvedaTools } from "@/core/agents/tools/ayurveda"
import { climaTools } from "@/core/agents/tools/clima"
import { finalizar } from "@/core/agents/tools/finalizar"
import { memoriaTools } from "@/core/agents/tools/memoria"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"

export function criarAcompanhante(): DefinicaoDoAgente {
  return {
    nome: "acompanhante",
    instrucoes: acompanhanteV1.instrucoes,
    prompt_versao: acompanhanteV1.versao,
    lembreteDeEntrega: acompanhanteV1.lembreteDeEntrega,
    tools: [...climaTools, ...memoriaTools, ...ayurvedaTools],
    controle: [finalizar as ToolDeControle<unknown>],
  }
}
