import { config } from "@config/index"
import { janelaDoMinuto } from "@/core/llm/janelas"
import { diaLocal } from "@/core/time/dia-local"
import type { ContaDoLimite } from "./estado"
import type { UsageLimiter } from "./ports"

export type Pedido = Parameters<UsageLimiter["consumir"]>[0][number]

const FUSO = config.clima.fusoPadrao

const prefixo = (escopo?: string) => (escopo ? `${escopo}:` : "")

// Conta comum: uma chave por conta no dia de hoje. Demo: a chave conta o dia da criação.
// O IP vale para todas as contas da mesma conexão.
export function chavesDeMensagem(
  conta: ContaDoLimite,
  ipHash: string,
  agora: Date,
  escopo?: string,
  teto?: number,
): { conta: Pedido; ip: Pedido } {
  const p = prefixo(escopo)
  const { googlePorDia, demoPorConta, porIpPorDia } = config.limites.mensagens
  const hoje = diaLocal(agora, FUSO)
  const ip: Pedido = { chave: `${p}msg:ip:${ipHash}`, teto: teto ?? porIpPorDia, inicio: hoje }
  if (conta.tipo === "demo") {
    return {
      conta: {
        chave: `${p}msg:demo:${conta.id}`,
        teto: teto ?? demoPorConta,
        inicio: diaLocal(new Date(conta.criado_em), FUSO),
      },
      ip,
    }
  }
  return {
    conta: { chave: `${p}msg:conta:${conta.id}`, teto: teto ?? googlePorDia, inicio: hoje },
    ip,
  }
}

export function chavesDeToque(
  conta: ContaDoLimite,
  ipHash: string,
  agora: Date,
  escopo?: string,
  teto?: number,
): { minuto: Pedido; dia: Pedido; ip: Pedido } {
  const p = prefixo(escopo)
  const { porContaPorMinuto, porContaPorDia, porIpPorDia } = config.limites.toques
  const hoje = diaLocal(agora, FUSO)
  return {
    minuto: {
      chave: `${p}toque:conta:${conta.id}`,
      teto: teto ?? porContaPorMinuto,
      inicio: janelaDoMinuto(agora),
    },
    dia: { chave: `${p}toque:conta:${conta.id}`, teto: teto ?? porContaPorDia, inicio: hoje },
    ip: { chave: `${p}toque:ip:${ipHash}`, teto: teto ?? porIpPorDia, inicio: hoje },
  }
}

// Início do minuto seguinte ao instante.
export function proximoMinuto(agora: Date): Date {
  const MINUTO_EM_MS = 60_000
  return new Date(Math.floor(agora.getTime() / MINUTO_EM_MS) * MINUTO_EM_MS + MINUTO_EM_MS)
}

// Segundos até o alvo, para o cabeçalho de nova tentativa: arredonda para cima e nunca dá zero.
export function segundosAte(agora: Date, alvo: Date): number {
  return Math.max(1, Math.ceil((alvo.getTime() - agora.getTime()) / 1000))
}
