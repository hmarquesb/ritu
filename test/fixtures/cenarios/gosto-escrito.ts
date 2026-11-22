import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Gosto dito na mensagem: o gengibre vira preferência na linha do bloco, e a aprovação grava.
export const gostoEscrito: Cenario = {
  nome: "gosto-escrito",
  descricao:
    "Diz que adora gengibre: linha Você gosta de gengibre no bloco, aprovada, e a preferência gravada",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "adoro gengibre, o que tomo agora?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: ["gengibre"],
    restricoes: [],
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: [
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
