import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Dois retornos aguardando (uma refeição de 2 dias e um chá de hoje); a pessoa diz que o chá ajudou.
export const retornoConversa: Cenario = {
  nome: "retorno-conversa",
  descricao:
    "Retorno de um chá, o mais recente dos dois pendentes: caminho retorno, contadores somados",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  retornos: [
    {
      sugestao: {
        tipo: "refeicao",
        preparo_id: "arroz-com-legume",
        alimentos: ["arroz-branco", "abobora"],
        titulo: "Arroz bem cozido com abóbora e ghee",
      },
      diasAtras: 2,
    },
    {
      sugestao: {
        tipo: "cha",
        pratica_id: "cha-gengibre-canela",
        alimentos: ["gengibre", "canela"],
        titulo: "Chá de gengibre com canela",
      },
      diasAtras: 0,
    },
  ],
  mensagem: { texto: "tomei o chá e melhorei", atalhos: [] },
  interpretacao: {
    intencoes: ["retorno"],
    estados: [],
    itens_casa: [],
    retorno: { resultado: "ajudou", pendente: 1 },
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [],
}
