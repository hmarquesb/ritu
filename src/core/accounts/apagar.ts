import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { Conta } from "./types"

// Apaga a conta e todos os dados dela (cascata no accounts.apagar) e soma a métrica por tipo de conta.
export async function apagarConta(
  deps: { stores: Stores; telemetry: Telemetry },
  conta: Conta,
): Promise<void> {
  const { stores, telemetry } = deps
  await stores.accounts.apagar(conta.id)
  telemetry.contador("ritu_conta_apagada_total", { tipo: conta.tipo })
}
