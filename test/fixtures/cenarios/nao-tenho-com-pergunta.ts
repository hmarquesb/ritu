import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"
import { trocaPorToque } from "./troca-por-toque"

// Mel sem substituto confirmado: Não tenho no mel pergunta pelo candidato nunca registrado, que também não tem.
export const naoTenhoComPergunta: Cenario = {
  nome: "nao-tenho-com-pergunta",
  descricao:
    "Momento do frio-agitada; toque Não tenho no mel: mel acabou, pergunta pelo candidato nunca registrado, Não tenho nele, semSubstituto",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
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
  toques: [
    {
      tipo: "troca",
      sugestao: 0,
      alimento_id: "mel",
      motivo: "nao_tenho",
      resposta: "nao_tenho",
    },
  ],
  roteiro: trocaPorToque.roteiro,
}
