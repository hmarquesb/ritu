import { frioAgitada } from "./frio-agitada"
import { historicoDoCha, roteiroDoMomento } from "./padrao-confirmado"
import type { Cenario } from "./tipos"

// O histórico do chá, e a pessoa aprova só a linha da casa: o padrão fica recusado e não volta a ser proposto.
export const padraoRecusado: Cenario = {
  nome: "padrao-recusado",
  descricao:
    "O mesmo histórico do chá; a mensagem tem momento e compra de abóbora: aprova a linha da casa, recusa o padrão e a detecção não propõe de novo",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  // Sem abóbora na casa antes da compra, como em aprovacao-parcial.
  casa: frioAgitada.casa.filter((item) => item.alimento_id !== "abobora"),
  clima: frioAgitada.clima,
  historico: historicoDoCha,
  detectar: true,
  mensagem: { texto: "Estou com frio e agitada. Comprei abóbora.", atalhos: [] },
  interpretacao: {
    intencoes: ["momento", "casa"],
    estados: ["com_frio", "agitada"],
    itens_casa: [{ nome: "abóbora", acao: "tem" }],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: roteiroDoMomento,
}
