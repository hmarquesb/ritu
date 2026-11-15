import type { Resultado } from "@/core/outcomes/ports"

export type ItemTipo = "alimento" | "pratica" | "preparo"

export type Preferencia = {
  conta_id: string
  item_tipo: ItemTipo
  item_id: string
  gosto: "gosta" | "nao_gosta" | null
  ajudou: number
  nao_ajudou: number
  nao_fez: number
  /** Até 2, o mais recente primeiro; só ajudou e nao_ajudou. */
  ultimos_resultados: ("ajudou" | "nao_ajudou")[]
  ultima_sugestao_em: string | null
}

export interface PreferenceStore {
  ler(contaId: string, itens?: { tipo: ItemTipo; id: string }[]): Promise<Preferencia[]>
  definirGosto(
    contaId: string,
    item: { tipo: ItemTipo; id: string },
    gosto: "gosta" | "nao_gosta" | null,
  ): Promise<void>
  /** Soma no contador; ajudou e nao_ajudou entram no início de ultimos_resultados. */
  contarResultado(
    contaId: string,
    item: { tipo: ItemTipo; id: string },
    resultado: Resultado,
  ): Promise<void>
  marcarSugerido(contaId: string, itens: { tipo: ItemTipo; id: string }[]): Promise<void>
  contagem(contaId: string): Promise<{ de_gosto: number; de_resultado: number }>
  apagar(contaId: string, item: { tipo: ItemTipo; id: string }): Promise<void>
}
