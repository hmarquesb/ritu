import { config } from "@config/index"
import { RituError } from "@/core/errors"

export type PrazosDaPolitica = {
  mensagensDias: number
  faltasDias: number
  retornosDias: number
  demonstracaoHoras: number
  sessaoDias: number
  temaDias: number
}

/** Prazos que a política de privacidade cita, lidos da configuração. */
export function prazosDaPolitica(): PrazosDaPolitica {
  return {
    mensagensDias: config.memoria.mensagensDias,
    faltasDias: config.memoria.faltasDias,
    retornosDias: config.memoria.retornosDias,
    demonstracaoHoras: config.limites.demo.duracaoHoras,
    sessaoDias: config.limites.sessao.dias,
    temaDias: config.ui.theme.maxAgeDays,
  }
}

const MARCADOR = /\{([A-Za-z0-9_.]+)\}/g

/** Troca cada {chave} do texto pelo valor. Chave sem valor lança RituError("texto_sem_valor"). */
export function preencher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(MARCADOR, (_, chave: string) => {
    if (!Object.hasOwn(valores, chave)) {
      throw new RituError("texto_sem_valor", `Falta o valor do marcador {${chave}}`)
    }
    return String(valores[chave])
  })
}
