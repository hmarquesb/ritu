import { config } from "@config/index"
import type { Durabilidade } from "@/core/knowledge/vocab"
import type { ItemDaCasa } from "./types"

export type EstadoCalculado = "confirmado" | "incerto" | "acabou" | "sempre_tenho"

const DIA_EM_MS = 86_400_000

export function estadoDoItem(
  item: ItemDaCasa,
  agora: Date,
  durabilidade: Durabilidade | undefined,
): EstadoCalculado {
  if (item.estado === "acabou") return "acabou"
  if (item.sempre_tenho) return "sempre_tenho"
  const dias = Math.floor((agora.getTime() - Date.parse(item.confirmado_em)) / DIA_EM_MS)
  const validade = config.casa.validadeDias[durabilidade ?? config.casa.durabilidadeDesconhecido]
  return dias > validade ? "incerto" : "confirmado"
}
