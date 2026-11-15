import type { ItemDaCasa } from "./types"

export type ReferenciaDeItem = { alimento_id?: string; nome_livre?: string }

export interface PantryStore {
  listar(contaId: string): Promise<ItemDaCasa[]>
  /** Estado tem, confirmado agora; apaga faltas e tira da lista. */
  registrar(contaId: string, itens: ReferenciaDeItem[], origem: ItemDaCasa["origem"]): Promise<void>
  marcarAcabou(contaId: string, itens: ReferenciaDeItem[]): Promise<void>
  definirSempreTenho(contaId: string, itemId: string, valor: boolean): Promise<void>
  tirar(contaId: string, itemId: string): Promise<void>
  /** Sem contaId. */
  desconhecidos(limite: number): Promise<{ nome: string; vezes: number }[]>
}
