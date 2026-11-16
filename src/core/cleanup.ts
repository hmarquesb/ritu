import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { UsageLimiter } from "@/core/limits/ports"
import type { UsageLedger } from "@/core/llm/ledger"
import type { Stores } from "@/core/stores"
import { diaLocal, diasAtras } from "@/core/time/dia-local"

const DIA_MS = 86_400_000
const MINUTO_MS = 60_000

export type ResultadoLimpeza = {
  mensagens: number
  mensagens_com_incomodo: number
  retornos: number
  faltas: number
  evitar_temporario: number
  runs_expirados: number
  propostas_expiradas: number
  demos: number
  llm_uso: number
  limites: number
}

// Apaga o que passou do prazo de memória, expira os runs em espera e apaga os limites de antes de ontem. Cortes por dia usam o fuso padrão.
export async function executarLimpeza(deps: {
  stores: Stores
  clock: Clock
  ledger: UsageLedger
  limiter: UsageLimiter
}): Promise<ResultadoLimpeza> {
  const { stores, clock, ledger, limiter } = deps
  const agora = clock.now()
  const hoje = diaLocal(agora)
  const { memoria } = config

  const mensagens = await stores.messages.apagarAntesDe(
    new Date(agora.getTime() - memoria.mensagensDias * DIA_MS),
  )
  const mensagens_com_incomodo = await stores.messages.apagarComIncomodoAntesDoDia(hoje)
  const retornos = await stores.outcomes.apagarAguardandoAntesDe(
    new Date(agora.getTime() - memoria.retornosDias * DIA_MS),
  )
  const faltas = await stores.shortages.apagarFaltasAntesDe(diasAtras(hoje, memoria.faltasDias))
  const evitar_temporario = await stores.profiles.apagarEvitarTemporarioAntesDe(hoje)
  const ids = await stores.runs.expirarEmEsperaAntesDe(
    new Date(agora.getTime() - memoria.esperaMinutos * MINUTO_MS),
  )
  const propostas_expiradas = await stores.proposals.expirarDosRuns(ids)
  const demos = await stores.accounts.apagarDemosVencidas()
  const llm_uso = await ledger.apagarAntigas()
  const limites = await limiter.apagarAntesDe(diasAtras(hoje, 1))

  return {
    mensagens,
    mensagens_com_incomodo,
    retornos,
    faltas,
    evitar_temporario,
    runs_expirados: ids.length,
    propostas_expiradas,
    demos,
    llm_uso,
    limites,
  }
}
