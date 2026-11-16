import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// O momento do frio-agitada pela conversa: três retornos aguardando, faltas do cardamomo e a linha da lista, aprovada.
export const entregaRegistrada: Cenario = {
  nome: "entrega-registrada",
  descricao:
    "Momento do frio-agitada pela conversa: três retornos aguardando, faltas gravadas, cardamomo para ter em casa aprovado na lista",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  faltas: frioAgitada.faltas,
  clima: frioAgitada.clima,
  mensagem: {
    texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
    atalhos: [],
  },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: frioAgitada.roteiro,
}
