import type { Prakriti } from "@/core/knowledge/adequacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"

export type Conta = {
  id: string
  tipo: "google" | "demo"
  google_sub: string | null
  email: string | null
  expira_em: string | null
  tester: boolean
  aviso_aceito_em: string | null
  evitar_passo: "pronto" | "nenhum" | "pulou" | null
  evitar_lembrete_em: string | null
  dosha_adiado_em: string | null
  criado_em: string
}

export type Perfil = {
  conta_id: string
  prakriti: Prakriti | null
  origem: "quiz" | "declarado" | null
  evitar_sempre: (EvitarItem & { desde: string })[]
  restricoes: Restricao[]
  nao_come: { tipo: "alimento" | "texto"; valor: string }[]
  cidade_nome: string | null
  cidade_lat: number | null
  cidade_lon: number | null
  cidade_fuso: string | null
  atualizado_em: string
}
