import { config } from "@config/index"
import { type PainelDoDosha, painelDoDosha } from "@/core/accounts/painel"
import type { Conta } from "@/core/accounts/types"
import type { Clock } from "@/core/clock"
import { montarFiltro } from "@/core/filtro-da-pessoa"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { lerCasa } from "@/core/pantry/ler"
import type { Stores } from "@/core/stores"
import { diaLocal, diasAtras } from "@/core/time/dia-local"
import { type MemoriaNaTela, visaoDaMemoria } from "./visao"

type Deps = { stores: Stores; kb: KnowledgeBase; clock: Clock }

export type VoceNaTela = {
  painel: PainelDoDosha
  memoria: MemoriaNaTela
  conta: { tipo: "google" | "demo"; horas_restantes: number | null }
  /** O fuso da pessoa: as datas da tela saem nele. */
  fuso: string
}

const HORA_EM_MS = 3_600_000

// Tudo o que "Você" mostra, lido só da conta pedida.
export async function lerVoce(deps: Deps, conta: Conta, fuso: string): Promise<VoceNaTela> {
  const { stores, kb, clock } = deps
  const agora = clock.now()
  const hoje = diaLocal(agora, fuso)
  const contaId = conta.id
  const [perfil, casa, preferencias, faltas, lista, notas, resumo, padroes, conversa] =
    await Promise.all([
      stores.profiles.ler(contaId),
      lerCasa(deps, contaId, fuso),
      stores.preferences.ler(contaId),
      stores.shortages.diasComFalta(contaId, diasAtras(hoje, config.memoria.faltasDias - 1)),
      stores.shortages.lista(contaId),
      stores.routine.notasAtivas(contaId),
      stores.routine.resumo(contaId),
      stores.patterns.listar(contaId),
      stores.messages.contarPorDia(contaId, diasAtras(hoje, config.memoria.mensagensDias - 1)),
    ])
  // Sem temporários do dia e sem itens da mensagem: a tela mostra o que a pessoa guardou.
  const { filtro } = montarFiltro({ perfil, evitarDoDia: [], evitarDaMensagem: [], preferencias })
  return {
    painel: painelDoDosha(perfil, kb),
    memoria: visaoDaMemoria({
      perfil,
      casa,
      preferencias,
      faltas,
      lista,
      notas,
      resumo,
      padroes,
      filtro,
      conversa,
      kb,
      agora,
      fuso,
    }),
    conta: { tipo: conta.tipo, horas_restantes: horasRestantes(conta, agora) },
    fuso,
  }
}

function horasRestantes(conta: Conta, agora: Date): number | null {
  if (conta.tipo !== "demo") return null
  if (conta.expira_em === null) return 0
  const restante = Date.parse(conta.expira_em) - agora.getTime()
  return Math.max(0, Math.floor(restante / HORA_EM_MS))
}
