import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// A pessoa conta o retorno na própria mensagem: o agente liga o "ajudou" ao pendente mais recente com resultado.registrar.
export const retornoPeloAgente: Cenario = {
  nome: "retorno-pelo-agente",
  descricao:
    "Retorno contado na mensagem com dois pendentes: resultado.registrar no pendente 1 (o mais recente), finalizar; o retorno fecha com origem conversa",
  agora: frioAgitada.agora,
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
      diasAtras: 1,
    },
    {
      sugestao: {
        tipo: "cha",
        pratica_id: "cha-gengibre-limao-mel",
        alimentos: ["gengibre", "canela"],
        titulo: "Chá de gengibre com canela",
      },
      diasAtras: 3,
    },
  ],
  mensagem: { texto: "aquilo de ontem me fez bem, e agora tô com frio", atalhos: [] },
  interpretacao: {
    intencoes: ["momento", "retorno"],
    estados: ["com_frio"],
    itens_casa: [],
    retorno: { resultado: "ajudou" },
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [
    {
      texto: "Vou anotar que o retorno de ontem ajudou.",
      chamadas: [{ nome: "resultado.registrar", argumentos: { pendente: 1 } }],
    },
    {
      texto: "Vou montar a resposta com o chá que aquece.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para agora, um chá quente de gengibre com limão e mel aquece sem pesar. Se puder, sente-se para comer, sem tela.",
            sugestoes: [
              {
                tipo: "cha",
                id: "cha-gengibre-limao-mel",
                motivo: "Aquece o corpo no fim do dia, com o que você tem em casa.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
}
