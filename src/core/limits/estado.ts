import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import { horaLocal, viradaDaCota } from "@/core/llm/janelas"
import type { ModelRouter } from "@/core/llm/router"
import type { Telemetry } from "@/core/telemetry/ports"
import { diaLocal } from "@/core/time/dia-local"
import { chavesDeMensagem } from "./chaves"
import type { UsageLimiter } from "./ports"

// Só os campos de Conta que os limites usam (sem importar accounts: evita ciclo de domínios).
// Uma Conta real é atribuível a este tipo.
export type ContaDoLimite = {
  id: string
  tipo: "google" | "demo"
  tester: boolean
  criado_em: string
  expira_em?: string | null
}

export type MotivoDoLimite = "conta" | "demo" | "ip"

export type EstadoDasMensagens =
  | { tipo: "livre" } // tester
  | { tipo: "contando"; restantes: number; demo: boolean } // menor folga entre conta e IP
  | { tipo: "esgotadas"; motivo: MotivoDoLimite }

export type EstadoDaCota = { esgotada: false } | { esgotada: true; volta_as: string } // "5h"

export type EstadoDosLimites = { mensagens: EstadoDasMensagens; cota_ia: EstadoDaCota }

export type DepsDosLimites = {
  limiter: UsageLimiter
  router: ModelRouter
  clock: Clock
  telemetry: Telemetry
}

// `fuso`: o da cidade do perfil ou `clima.fusoPadrao` (só para a hora da virada)
// `teto`: só no modo e2e; substitui todos os tetos de mensagem e de toque deste pedido
export type QuemPede = {
  conta: ContaDoLimite
  ipHash: string
  fuso: string
  escopo?: string
  teto?: number
}

// Estado para a tela: sem consumir nada e sem chamar modelo. Tester vê as mensagens livres.
export async function estadoDosLimites(
  deps: DepsDosLimites,
  q: QuemPede,
): Promise<EstadoDosLimites> {
  const agora = deps.clock.now()
  const cota_ia = await estadoDaCota(deps, q, agora)
  if (q.conta.tester) return { mensagens: { tipo: "livre" }, cota_ia }
  const hoje = diaLocal(agora, config.clima.fusoPadrao)
  const { conta, ip } = chavesDeMensagem(q.conta, q.ipHash, agora, q.escopo, q.teto)
  const usadoDaConta = await deps.limiter.usado(conta.chave, "dia", conta.inicio ?? hoje)
  const usadoDoIp = await deps.limiter.usado(ip.chave, "dia", ip.inicio ?? hoje)
  const mensagens = mensagensDe(q, conta.teto - usadoDaConta, ip.teto - usadoDoIp)
  return { mensagens, cota_ia }
}

async function estadoDaCota(deps: DepsDosLimites, q: QuemPede, agora: Date): Promise<EstadoDaCota> {
  if (!(await deps.router.cotaDoDiaEsgotada("decisao"))) return { esgotada: false }
  return { esgotada: true, volta_as: horaLocal(viradaDaCota(agora), q.fuso) }
}

// Conta antes do IP: se os dois acabaram, o motivo é o da conta.
function mensagensDe(q: QuemPede, folgaDaConta: number, folgaDoIp: number): EstadoDasMensagens {
  const demo = q.conta.tipo === "demo"
  if (folgaDaConta <= 0) return { tipo: "esgotadas", motivo: demo ? "demo" : "conta" }
  if (folgaDoIp <= 0) return { tipo: "esgotadas", motivo: "ip" }
  return { tipo: "contando", restantes: Math.min(folgaDaConta, folgaDoIp), demo }
}
