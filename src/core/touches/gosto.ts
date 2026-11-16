import { RituError } from "@/core/errors"
import type { ItemTipo } from "@/core/preferences/ports"
import type { Deps } from "./deps"

type Item = { tipo: ItemTipo; id: string }

function estaNaBase(deps: Deps, item: Item): boolean {
  switch (item.tipo) {
    case "alimento":
      return deps.kb.alimento(item.id) !== undefined
    case "preparo":
      return deps.kb.preparo(item.id) !== undefined
    case "pratica":
      return deps.kb.pratica(item.id) !== undefined
  }
}

export async function tocarGosto(
  deps: Deps,
  contaId: string,
  item: Item,
  gosto: "gosta" | "nao_gosta" | null,
): Promise<void> {
  await deps.telemetry.span("toque", { tipo: "gosto" }, async () => {
    if (!estaNaBase(deps, item)) throw new RituError("toque_invalido", "Toque inválido")
    await deps.stores.preferences.definirGosto(contaId, item, gosto)
    deps.telemetry.contador("ritu_gosto_total", { gosto: gosto ?? "limpou" })
  })
}
