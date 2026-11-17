import { RituError } from "@/core/errors"
import type { ItemTipo } from "@/core/preferences/ports"
import { nomeNaBase } from "./base"
import type { Deps } from "./deps"

type Item = { tipo: ItemTipo; id: string }

export async function tocarGosto(
  deps: Deps,
  contaId: string,
  item: Item,
  gosto: "gosta" | "nao_gosta" | null,
): Promise<void> {
  await deps.telemetry.span("toque", { tipo: "gosto" }, async () => {
    if (nomeNaBase(deps.kb, item) === undefined)
      throw new RituError("toque_invalido", "Toque inválido")
    await deps.stores.preferences.definirGosto(contaId, item, gosto)
    deps.telemetry.contador("ritu_gosto_total", { gosto: gosto ?? "limpou" })
  })
}
