import { AsyncLocalStorage } from "node:async_hooks"
import type { Clock } from "@/core/clock"

/** Lê o instante pedido (ISO 8601) do pedido em andamento; sem pedido ou sem valor, `undefined`. */
export type LeitorDeInstante = () => Promise<string | undefined>

/** Instante do header `x-ritu-e2e-agora` do pedido do Next; fora de pedido, sem header ou inválido, `undefined`. */
export async function instanteDoPedidoNext(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers")
    return (await headers()).get("x-ritu-e2e-agora")?.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * Relógio do modo e2e. Fora de `comRelogio`, ou com instante ausente ou inválido, é o relógio de base;
 * dentro dele, é o instante do pedido (cada pedido tem o seu, sem se misturar).
 */
export function createRelogioE2e(base: Clock): {
  clock: Clock
  comRelogio<T>(leitor: LeitorDeInstante, fn: () => Promise<T>): Promise<T>
} {
  const armazenamento = new AsyncLocalStorage<Date>()
  return {
    clock: { now: () => armazenamento.getStore() ?? base.now() },
    async comRelogio(leitor, fn) {
      let texto: string | undefined
      try {
        texto = await leitor()
      } catch {
        texto = undefined
      }
      const instante = texto ? new Date(texto) : undefined
      if (!instante || Number.isNaN(instante.getTime())) return fn()
      return armazenamento.run(instante, fn)
    },
  }
}
