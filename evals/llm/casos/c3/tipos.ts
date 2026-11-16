import type { ResumoFeito } from "@/core/agents/memory/memoria"
import type { CasoConversa } from "../c2/tipos"

// Nota de rotina do caso: o texto e quantos dias atrás a nota foi criada, a partir do relógio do eval.
export type NotaDoCaso = { texto: string; diasAtras: number }

// O que a Memória entrega ao caso: o resumo feito e as notas do caso.
export type ExpectativaDaMemoria = {
  descricao: string
  confere: (r: { resumo: ResumoFeito; notas: NotaDoCaso[] }) => boolean
}

export type CasoMemoria = {
  tipo: "memoria"
  id: string
  titulo: string
  notas: NotaDoCaso[]
  // Pede o juiz do eval (caso 5): uma checagem a mais em deve.
  juiz?: true
  familia: "memoria"
  deve: ExpectativaDaMemoria[]
  naoPode: ExpectativaDaMemoria[]
}

export type CasoC3 = CasoMemoria | CasoConversa
