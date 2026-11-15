import type { MensagemNoPrompt } from "@/core/agents/interpreter/entrada"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { Estado } from "@/core/knowledge/vocab"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { Caminho } from "@/core/runs/ports"
import type { CenarioDeConversa } from "../../../../test/fixtures/cenarios/tipos"
import type { ResultadoDoRun } from "../c1/tipos"

// O que o Intérprete entrega ao caso: a interpretação já normalizada e o caminho que ela leva.
export type ExpectativaDoInterprete = {
  descricao: string
  confere: (r: { interpretacao: Interpretacao; caminho: Caminho }) => boolean
}

export type CasoInterprete = {
  tipo: "interprete"
  id: string
  titulo: string
  mensagem: string
  atalhos?: Estado[]
  conversa?: MensagemNoPrompt[]
  pendentes?: { tipo: SugestaoRegistrada["tipo"]; titulo: string }[]
  deve: ExpectativaDoInterprete[]
  naoPode: ExpectativaDoInterprete[]
  falsoAlerta?: true
}

// O que a conversa entrega ao caso: a resposta da conversa e o resultado colhido do run.
export type ExpectativaDaConversa = {
  descricao: string
  confere: (r: { resposta: RespostaDaConversa; resultado: ResultadoDoRun }) => boolean
}

export type CasoConversa = {
  tipo: "conversa"
  id: string
  titulo: string
  // Cenário da conversa: como CenarioDoCaso, com mensagem obrigatória e sem entrada de acompanhante.
  cenario: Omit<CenarioDeConversa, "roteiro">
  deve: ExpectativaDaConversa[]
  naoPode: ExpectativaDaConversa[]
}

export type CasoC2 = CasoInterprete | CasoConversa
