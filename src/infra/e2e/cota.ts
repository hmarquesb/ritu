import type { Clock } from "@/core/clock"
import type { UsageLedger } from "@/core/llm/ledger"
import type { ModelRouter } from "@/core/llm/router"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"

/** Lê o `x-ritu-e2e` do pedido em andamento; sem pedido ou sem header, `undefined`. */
export type LeitorDeEscopo = () => Promise<string | undefined>

/**
 * Registro de uso do modo e2e: um ledger em memória por `x-ritu-e2e`, como os dados de cada teste.
 * Sem o header, todos os pedidos dividem um ledger só.
 */
export function createLedgerE2e(clock: Clock, escopoAtual: LeitorDeEscopo): UsageLedger {
  const porEscopo = new Map<string, UsageLedger>()
  async function atual(): Promise<UsageLedger> {
    const id = (await escopoAtual()) ?? ""
    let ledger = porEscopo.get(id)
    if (!ledger) {
      ledger = createMemoryLedger(clock)
      porEscopo.set(id, ledger)
    }
    return ledger
  }
  return {
    async reservar(modelo, limites) {
      return (await atual()).reservar(modelo, limites)
    },
    async registrarTokens(modelo, tokens) {
      return (await atual()).registrarTokens(modelo, tokens)
    },
    async registrarRateLimit(modelo) {
      return (await atual()).registrarRateLimit(modelo)
    },
    async uso() {
      return (await atual()).uso()
    },
    async apagarAntigas() {
      return (await atual()).apagarAntigas()
    },
  }
}

/** Escopo do pedido do Next: o header `x-ritu-e2e`, ou nada fora de um pedido. */
export async function escopoDoPedidoNext(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers")
    return (await headers()).get("x-ritu-e2e")?.trim() || undefined
  } catch {
    return undefined
  }
}

/** Verdadeiro quando o pedido do Next leva `x-ritu-e2e-cota: esgotada`; fora de pedido, falso. */
export async function cotaEsgotadaNoPedidoNext(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers")
    return (await headers()).get("x-ritu-e2e-cota")?.trim() === "esgotada"
  } catch {
    return false
  }
}

/** Router do modo e2e: com `cotaEsgotada()` verdadeiro, a cota do dia do papel `decisao` some; o resto delega. */
export function createRouterE2e(
  router: ModelRouter,
  cotaEsgotada: () => Promise<boolean>,
): ModelRouter {
  return {
    paraPapel: (papel, opts) => router.paraPapel(papel, opts),
    async temModelo(papel) {
      return papel === "decisao" && (await cotaEsgotada()) ? false : router.temModelo(papel)
    },
    async cotaDoDiaEsgotada(papel) {
      return papel === "decisao" && (await cotaEsgotada()) ? true : router.cotaDoDiaEsgotada(papel)
    },
  }
}
