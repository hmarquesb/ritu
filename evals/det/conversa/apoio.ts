import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import { cenariosDeConversa } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Apoio dos evals de conversa. Não é *.eval.ts: o glob do eval:det não o roda como teste.

// Sem sinais: a saída do Intérprete parte daqui e cada caso põe só o que importa.
export const SEM_SINAIS = {
  estados: [],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

export function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeConversa[nome]
  if (!c) throw new Error(`cenário de conversa ausente: ${nome}`)
  return c
}

// Troca a mensagem e a saída do Intérprete de um cenário de conversa.
export function com(
  base: CenarioDeConversa,
  texto: string,
  parcial: Partial<SaidaDoInterprete> & Pick<SaidaDoInterprete, "intencoes">,
): CenarioDeConversa {
  return {
    ...base,
    mensagem: { texto, atalhos: [] },
    interpretacao: { ...SEM_SINAIS, ...parcial },
  }
}
