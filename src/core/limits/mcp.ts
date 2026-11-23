import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import { janelaDoMinuto } from "@/core/llm/janelas"
import type { Telemetry } from "@/core/telemetry/ports"
import { diaLocal } from "@/core/time/dia-local"
import { proximoMinuto, segundosAte } from "./chaves"
import { LimiteError } from "./erros"
import type { UsageLimiter } from "./ports"
import { proximaMeiaNoite } from "./toques"

type Barrado = { ok: false; erro: LimiteError }
type MotivoDoMcp = "minuto" | "ip" | "global"

// Chamadas ao MCP público: toda requisição POST conta. Minuto e dia por IP, e um teto global por dia.
export async function consumirMcp(
  deps: { limiter: UsageLimiter; clock: Clock; telemetry: Telemetry },
  ipHash: string,
): Promise<{ ok: true } | Barrado> {
  const agora = deps.clock.now()
  const chaveDoIp = `mcp:ip:${ipHash}`
  const chaveGlobal = "mcp:global"
  const { porIpPorMinuto, porIpPorDia, globalPorDia } = config.limites.mcp

  const porMinuto = await deps.limiter.consumir(
    [{ chave: chaveDoIp, teto: porIpPorMinuto }],
    "minuto",
    janelaDoMinuto(agora),
  )
  if (!porMinuto.ok) {
    return barrado(deps, "minuto", segundosAte(agora, proximoMinuto(agora)))
  }

  const hoje = diaLocal(agora, config.clima.fusoPadrao)
  const porDia = await deps.limiter.consumir(
    [
      { chave: chaveDoIp, teto: porIpPorDia },
      { chave: chaveGlobal, teto: globalPorDia },
    ],
    "dia",
    hoje,
  )
  if (porDia.ok) return { ok: true }
  const motivo: MotivoDoMcp = porDia.chave === chaveDoIp ? "ip" : "global"
  const meiaNoite = proximaMeiaNoite(agora, config.clima.fusoPadrao)
  return barrado(deps, motivo, segundosAte(agora, meiaNoite))
}

function barrado(
  deps: { telemetry: Telemetry },
  motivo: MotivoDoMcp,
  retryAfterS: number,
): Barrado {
  deps.telemetry.contador("ritu_limite_total", {
    tipo: "mcp",
    motivo,
    resultado: "barrado",
  })
  return { ok: false, erro: new LimiteError("limite_mcp", retryAfterS) }
}
