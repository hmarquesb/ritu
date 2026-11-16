import { RituError } from "@/core/errors"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"

type DepsDaDecisao = { stores: Stores; telemetry: Telemetry }

export async function decidirPadrao(
  deps: DepsDaDecisao,
  contaId: string,
  padraoId: string,
  decisao: "confirmado" | "recusado",
): Promise<void> {
  const { stores, telemetry } = deps
  const candidatos = await stores.patterns.listar(contaId, "candidato")
  const padrao = candidatos.find((p) => p.id === padraoId)
  if (!padrao) throw new RituError("padrao_invalido", "Padrão inválido")
  await stores.patterns.decidir(contaId, padraoId, decisao)
  telemetry.contador("ritu_padroes_total", { tipo: padrao.tipo, etapa: decisao })
}

export async function apagarPadrao(
  deps: { stores: Stores },
  contaId: string,
  padraoId: string,
): Promise<void> {
  const { stores } = deps
  const padroes = await stores.patterns.listar(contaId)
  if (!padroes.some((p) => p.id === padraoId))
    throw new RituError("padrao_invalido", "Padrão inválido")
  await stores.patterns.apagar(contaId, padraoId)
}
