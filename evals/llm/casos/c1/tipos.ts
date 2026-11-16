import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { Run } from "@/core/runs/ports"
import type { Cenario } from "../../../../test/fixtures/cenarios"
import type { BaseDoCaso } from "../../tipos"

// Cenário do caso: o mesmo do Acompanhante, sem roteiro (quem responde é o modelo real).
export type CenarioDoCaso = Omit<Cenario, "roteiro">

// O que o runner colhe de um run: a parte estruturada da saída e as etapas, nunca o texto de tool.
export type ResultadoDoRun = {
  saida: SaidaDoAcompanhante
  status: Run["status"]
  tools: string[]
  chamadasDeModelo: number
  validacoes: ("ok" | "falhou" | "recusado")[]
}

export type Expectativa = {
  descricao: string
  confere: (r: ResultadoDoRun) => boolean
}

export type Trajetoria = {
  chamadas?: string[]
  proibidas?: string[]
  maxChamadasDeModelo?: number
}

export type CasoC1 = BaseDoCaso & {
  tipo: "acompanhante"
  cenario: CenarioDoCaso
  deve: Expectativa[]
  naoPode: Expectativa[]
  trajetoria?: Trajetoria
}
