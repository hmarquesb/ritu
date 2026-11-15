import { autocorrecao } from "./autocorrecao"
import { estomagoPesado } from "./estomago-pesado"
import { frioAgitada } from "./frio-agitada"
import { perguntaManga } from "./pergunta-manga"
import { semModelo } from "./sem-modelo"
import type { Cenario } from "./tipos"

export const cenarios: Record<string, Cenario> = {
  "frio-agitada": frioAgitada,
  "pergunta-manga": perguntaManga,
  autocorrecao,
  "estomago-pesado": estomagoPesado,
  "sem-modelo": semModelo,
}

export { type DepsDoCenario, montarCenario, type OpcoesDoCenario } from "./montar"
export type { Cenario } from "./tipos"
