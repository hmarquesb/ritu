import { RituError } from "@/core/errors"
import type { Resultado, Retorno } from "@/core/outcomes/ports"
import { registrarResultado } from "@/core/outcomes/registrar"
import type { Deps } from "./deps"

export async function tocarRetorno(
  deps: Deps,
  contaId: string,
  retornoId: string,
  resultado: Resultado,
): Promise<Retorno> {
  return deps.telemetry.span("toque", { tipo: "retorno" }, async () => {
    const retorno = await registrarResultado(deps, contaId, retornoId, resultado, "toque")
    if (!retorno) throw new RituError("toque_invalido", "Toque inválido")
    return retorno
  })
}
