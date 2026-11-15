import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Uma restrição pedida pela pessoa: caminho evitar, grupo no filtro do dia e anotação.
export const evitarSozinho: Cenario = {
  nome: "evitar-sozinho",
  descricao: "Pede para não comer camarão: caminho evitar, grupo frutos do mar no filtro do dia",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "não posso comer camarão", atalhos: [] },
  interpretacao: {
    intencoes: ["evitar"],
    estados: [],
    itens_casa: [],
    evitar_sempre: ["camarão"],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [],
}
