import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { Veredito } from "@/core/agents/judge/julgar"
import type { MotivoDoJuiz } from "@/core/agents/judge/saida"
import type { ResumoFeito } from "@/core/agents/memory/memoria"
import type { BaseDoCaso } from "../../tipos"
import type { CasoConversa } from "../c2/tipos"

// Nota de rotina do caso: o texto e quantos dias atrás a nota foi criada, a partir do relógio do eval.
export type NotaDoCaso = { texto: string; diasAtras: number }

// O que a Memória entrega ao caso: o resumo feito e as notas do caso.
export type ExpectativaDaMemoria = {
  descricao: string
  confere: (r: { resumo: ResumoFeito; notas: NotaDoCaso[] }) => boolean
}

export type CasoMemoria = BaseDoCaso & {
  tipo: "memoria"
  notas: NotaDoCaso[]
  deve: ExpectativaDaMemoria[]
  naoPode: ExpectativaDaMemoria[]
}

// O que o Juiz entrega ao caso: o veredito da leitura (ok: false quando o modelo não respondeu).
export type ExpectativaDoJuiz = { descricao: string; confere: (v: Veredito) => boolean }

// Caso do Juiz: uma resposta pronta, conferida pelo Juiz sozinho (sem run nem Acompanhante).
export type CasoJuiz = BaseDoCaso & {
  tipo: "juiz"
  saida: SaidaDoAcompanhante
  evitar: string[] // <nunca_citar>
  nota_de_rotina?: string
  motivos: MotivoDoJuiz[] // os que o caso espera ver apontados (vazio: nenhum)
  deve: ExpectativaDoJuiz[]
  naoPode: ExpectativaDoJuiz[]
}

export type CasoC3 = CasoMemoria | CasoJuiz | CasoConversa
