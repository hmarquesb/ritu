import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { DemoSeed } from "@/core/demo-seed"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { UsageLimiter } from "@/core/limits/ports"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { diaLocal } from "@/core/time/dia-local"
import { copiarSeed } from "./copiar-seed"
import type { Conta } from "./types"

const HORA_EM_MS = 3_600_000

export class LimiteDeDemonstracaoError extends RituError {
  constructor(code: "demo_limite_ip" | "demo_limite_global") {
    super(
      code,
      code === "demo_limite_ip"
        ? "Você já usou as demonstrações de hoje"
        : "As demonstrações de hoje acabaram",
    )
    this.name = "LimiteDeDemonstracaoError"
  }
}

export async function entrarComGoogle(
  deps: { stores: Stores; telemetry: Telemetry },
  dados: { sub: string; email: string },
): Promise<Conta> {
  const { stores, telemetry } = deps
  const contar = (resultado: "nova" | "retorno") =>
    telemetry.contador("ritu_entrada_total", {
      "conta.tipo": "google",
      "entrada.resultado": resultado,
    })
  const existente = await stores.accounts.buscarPorGoogleSub(dados.sub)
  if (existente) {
    contar("retorno")
    return existente
  }
  try {
    const nova = await stores.accounts.criar({
      tipo: "google",
      google_sub: dados.sub,
      email: dados.email,
    })
    contar("nova")
    return nova
  } catch (erro) {
    // Corrida: outra entrada criou a conta entre a busca e a criação.
    const achada = await stores.accounts.buscarPorGoogleSub(dados.sub)
    if (!achada) throw erro
    contar("retorno")
    return achada
  }
}

type DepsDemo = {
  tx: Transactor
  limiter: UsageLimiter
  clock: Clock
  kb: KnowledgeBase
  seed: DemoSeed
  telemetry: Telemetry
}

async function consumirLimites(
  deps: DepsDemo,
  dados: { ipHash: string; escopo?: string },
): Promise<void> {
  const { porIpPorDia, globalPorDia } = config.limites.demo
  const p = dados.escopo ? `${dados.escopo}:` : ""
  const chaveIp = `${p}demo:ip:${dados.ipHash}`
  const hoje = diaLocal(deps.clock.now())
  const r = await deps.limiter.consumir(
    [
      { chave: chaveIp, teto: porIpPorDia },
      { chave: `${p}demo:global`, teto: globalPorDia },
    ],
    "dia",
    hoje,
  )
  if (r.ok) return
  const codigo = r.chave === chaveIp ? "demo_limite_ip" : "demo_limite_global"
  deps.telemetry.contador("ritu_entrada_total", {
    "conta.tipo": "demo",
    "entrada.resultado": codigo === "demo_limite_ip" ? "limite_ip" : "limite_global",
  })
  throw new LimiteDeDemonstracaoError(codigo)
}

export async function criarDemonstracao(
  deps: DepsDemo,
  dados: { ipHash: string; escopo?: string; semSeed?: boolean },
): Promise<Conta> {
  await consumirLimites(deps, dados)
  const agora = deps.clock.now()
  const expira_em = new Date(agora.getTime() + config.limites.demo.duracaoHoras * HORA_EM_MS)
  const conta = await deps.tx.emTransacao(async (stores) => {
    const criada = await stores.accounts.criar({ tipo: "demo", expira_em })
    if (dados.semSeed) return criada
    await copiarSeed(stores, criada.id, deps.seed, { clock: deps.clock, kb: deps.kb })
    await stores.accounts.marcar(criada.id, { evitar_passo: "pronto" })
    return (await stores.accounts.buscar(criada.id)) ?? criada
  })
  deps.telemetry.contador("ritu_entrada_total", {
    "conta.tipo": "demo",
    "entrada.resultado": "nova",
  })
  return conta
}
