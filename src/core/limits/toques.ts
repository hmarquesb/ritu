import { config } from "@config/index"
import { janelaDoMinuto } from "@/core/llm/janelas"
import { diaLocal } from "@/core/time/dia-local"
import { chavesDeToque, segundosAte } from "./chaves"
import { LimiteError } from "./erros"
import type { DepsDosLimites, QuemPede } from "./estado"

type Barrado = { ok: false; erro: LimiteError }
type MotivoDeToque = "minuto" | "dia" | "ip"

// Toques (retorno, troca, gosto, casa) não contam nas mensagens; têm minuto, dia e IP.
// Tester passa sem consumir.
export async function consumirToque(
  deps: DepsDosLimites,
  q: QuemPede,
): Promise<{ ok: true } | Barrado> {
  if (q.conta.tester) return { ok: true }
  const agora = deps.clock.now()
  const { minuto, dia, ip } = chavesDeToque(q.conta, q.ipHash, agora, q.escopo, q.teto)

  const porMinuto = await deps.limiter.consumir([minuto], "minuto", janelaDoMinuto(agora))
  if (!porMinuto.ok) {
    return barrado(deps, "minuto", segundosAte(agora, proximoMinuto(agora)))
  }

  const hoje = diaLocal(agora, config.clima.fusoPadrao)
  const porDia = await deps.limiter.consumir([dia, ip], "dia", hoje)
  if (porDia.ok) return { ok: true }
  const motivo: MotivoDeToque = porDia.chave === ip.chave ? "ip" : "dia"
  const meiaNoite = proximaMeiaNoite(agora, config.clima.fusoPadrao)
  return barrado(deps, motivo, segundosAte(agora, meiaNoite))
}

function barrado(deps: DepsDosLimites, motivo: MotivoDeToque, retryAfterS: number): Barrado {
  deps.telemetry.contador("ritu_limite_total", {
    tipo: "toque",
    motivo,
    resultado: "barrado",
  })
  return { ok: false, erro: new LimiteError("limite_toques", retryAfterS) }
}

function proximoMinuto(agora: Date): Date {
  const MINUTO_EM_MS = 60_000
  return new Date(Math.floor(agora.getTime() / MINUTO_EM_MS) * MINUTO_EM_MS + MINUTO_EM_MS)
}

// Próxima meia-noite do fuso: a partir da hora local do instante, sem depender do deslocamento.
export function proximaMeiaNoite(agora: Date, fuso: string): Date {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  })
  const partes = Object.fromEntries(
    formato.formatToParts(agora).map((p) => [p.type, Number(p.value)]),
  )
  const segundosDoDia =
    ((partes.hour ?? 0) % 24) * 3600 + (partes.minute ?? 0) * 60 + (partes.second ?? 0)
  return new Date(agora.getTime() + (86_400 - segundosDoDia) * 1000 - agora.getMilliseconds())
}
