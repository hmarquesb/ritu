import { z } from "zod"
import { RituError } from "@/core/errors"
import type { Stores } from "@/core/stores"
import type { Deps } from "./deps"

export const acaoDaListaSchema = z.strictObject({
  acao: z.enum(["por", "tirar"]),
  alimento_id: z.string().min(1).max(60),
})

export type AcaoDaLista = z.infer<typeof acaoDaListaSchema>

async function porNaLista(stores: Stores, contaId: string, alimentoId: string): Promise<void> {
  const jaNaLista = (await stores.shortages.lista(contaId)).some(
    (l) => l.alimento_id === alimentoId,
  )
  if (jaNaLista) return
  await stores.shortages.porNaLista(contaId, {
    alimento_id: alimentoId,
    motivo: "pessoa",
    detalhe: "",
  })
}

async function tirarDaLista(stores: Stores, contaId: string, alimentoId: string): Promise<void> {
  await stores.shortages.tirarDaLista(contaId, alimentoId)
  await stores.shortages.apagarDoAlimento(contaId, alimentoId)
}

export function tocarLista(
  deps: Deps,
  contaId: string,
  acao: AcaoDaLista,
): Promise<{ nome: string }> {
  return deps.telemetry.span("toque", { tipo: "lista" }, () =>
    deps.tx.emTransacao(async (stores) => {
      const nome = deps.kb.alimento(acao.alimento_id)?.nome
      if (!nome) throw new RituError("toque_invalido", "Toque inválido")
      if (acao.acao === "por") await porNaLista(stores, contaId, acao.alimento_id)
      else await tirarDaLista(stores, contaId, acao.alimento_id)
      return { nome }
    }),
  )
}
