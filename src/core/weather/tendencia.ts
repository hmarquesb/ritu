import { clima } from "@config/clima"
import type { Clima } from "./ports"

export type Tendencia = {
  temperatura: "esquenta" | "esfria" | "estavel"
  chuva: boolean
  ate: string
}

// Tolerância para erro de ponto flutuante na comparação com a variação mínima.
const EPSILON = 1e-9

export function tendenciaDasProximasHoras(c: Clima): Tendencia {
  const consideradas = c.proximas_horas.slice(0, clima.tendencia.horas)
  const ultima = consideradas.at(-1)
  if (!ultima) return { temperatura: "estavel", chuva: false, ate: c.observado_em }

  const variacao = ultima.temperatura_aparente - c.temperatura_aparente
  return {
    temperatura: direcao(variacao, clima.tendencia.variacaoMinima),
    chuva: consideradas.some((h) => h.prob_chuva >= clima.chuva.probabilidadeMinima),
    ate: ultima.hora,
  }
}

function direcao(variacao: number, minima: number): Tendencia["temperatura"] {
  if (variacao >= minima - EPSILON) return "esquenta"
  if (variacao <= -minima + EPSILON) return "esfria"
  return "estavel"
}
