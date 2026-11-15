import { config } from "@config/index"
import { DOSHAS, type Dosha, type Guna, OPOSTO } from "./vocab"

export type Prakriti = Partial<Record<Dosha, number>>

type ItemAdequacao = { gunas: Guna[]; efeito?: Record<Dosha, number> }

function pontosDasGunas(gunas: Guna[], buscadas: Guna[]): number {
  const { porQualidadeBuscada, porQualidadeOposta } = config.adequacao
  return gunas.reduce((soma, guna) => {
    const buscada = buscadas.includes(guna) ? porQualidadeBuscada : 0
    const oposta = buscadas.includes(OPOSTO[guna]) ? porQualidadeOposta : 0
    return soma + buscada + oposta
  }, 0)
}

function pontosDoEfeito(efeito: Record<Dosha, number>, prakriti: Prakriti): number {
  const { porPontoDeEfeito } = config.adequacao
  return DOSHAS.reduce(
    (soma, dosha) => soma + porPontoDeEfeito * efeito[dosha] * (prakriti[dosha] ?? 0),
    0,
  )
}

export function notaAdequacao(
  item: ItemAdequacao,
  buscadas: Guna[],
  prakriti?: Prakriti,
): { nota: number; contribui: Guna[] } {
  const pontosGunas = pontosDasGunas(item.gunas, buscadas)
  const pontosEfeito = prakriti && item.efeito ? pontosDoEfeito(item.efeito, prakriti) : 0
  return {
    nota: pontosGunas + pontosEfeito,
    contribui: item.gunas.filter((guna) => buscadas.includes(guna)),
  }
}
