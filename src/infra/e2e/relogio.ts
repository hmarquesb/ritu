import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import { momentoDoDia } from "@/core/knowledge/momento"
import { horaLocal } from "@/core/weather/hora-local"

const HORA_MS = 3_600_000
const HORA_ALVO = 1

// Relógio do modo e2e: anda junto com o real (minutos, segundos e tempo decorrido reais), mas
// deslocado em horas inteiras para a hora local cair à noite. O roteiro da pergunta de casa só
// tem candidatos de noite, então o teste não depende da hora em que roda. O deslocamento só muda
// quando o real sai da faixa da noite.
export function createRelogioE2e(real: Clock, fuso: string = config.clima.fusoPadrao): Clock {
  let deslocamento: number | undefined
  const deslocado = (agora: Date, ms: number) => new Date(agora.getTime() + ms)
  return {
    now() {
      const agora = real.now()
      if (
        deslocamento !== undefined &&
        momentoDoDia(horaLocal(deslocado(agora, deslocamento), fuso)) === "noite"
      ) {
        return deslocado(agora, deslocamento)
      }
      const horas = (HORA_ALVO - horaLocal(agora, fuso) + 24) % 24
      deslocamento = horas * HORA_MS
      return deslocado(agora, deslocamento)
    },
  }
}
