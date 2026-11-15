import type { EvitarItem } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { Perfil } from "./types"

// Checagens de "já está no perfil", usadas pelo texto da conversa e pelas anotações.
// Por id quando o alimento foi reconhecido; senão, pelo nome normalizado do texto livre.
export function citadoNoPerfilDoNaoCome(
  citado: { alimento_id?: string; nome: string },
  perfil: Perfil,
): boolean {
  const tipo = citado.alimento_id ? "alimento" : "texto"
  const valor = citado.alimento_id ?? normalizar(citado.nome)
  return perfil.nao_come.some((item) => item.tipo === tipo && item.valor === valor)
}

export function itemNoPerfilDoEvitar(item: EvitarItem, perfil: Perfil): boolean {
  return perfil.evitar_sempre.some(
    (guardado) => guardado.tipo === item.tipo && guardado.valor === item.valor,
  )
}
