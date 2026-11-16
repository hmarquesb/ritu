import { RituError } from "@/core/errors"
import type { Deps } from "./deps"

export async function tocarVoto(
  deps: Deps,
  contaId: string,
  runId: string,
  voto: "up" | "down",
): Promise<void> {
  await deps.telemetry.span("toque", { tipo: "voto" }, async () => {
    const run = await deps.stores.runs.buscar(contaId, runId)
    if (!run || run.saida === null) throw new RituError("toque_invalido", "Toque inválido")
    const anterior = await deps.stores.runs.votar(contaId, runId, voto)
    if (anterior !== voto) deps.telemetry.contador("ritu_feedback_total", { voto })
  })
}
