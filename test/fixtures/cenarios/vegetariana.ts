import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Restrição dita na mensagem: a linha do bloco é a restrição; "Agora não" não grava nada, e a segunda mensagem vem depois.
export const vegetariana: Cenario = {
  nome: "vegetariana",
  descricao:
    "Diz que é vegetariana: bloco com a restrição, Agora não deixa o perfil como estava; a segunda mensagem sai com sugestão vegetariana",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "sou vegetariana, o que eu como agora?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: ["vegetariana"],
    suspeito: false,
  },
  aprovacao: "agora_nao",
  roteiro: [
    {
      texto: "Vou montar a resposta sem carne nem peixe.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para agora, uma refeição morna de arroz com abóbora fica bem e segue o que você disse. Se puder, sente-se para comer, sem tela.",
            sugestoes: [
              {
                tipo: "refeicao",
                id: "arroz-com-legume",
                motivo: "Uma comida morna e cozida, sem carne nem peixe.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
  depois: {
    mensagem: { texto: "e no jantar?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
    roteiro: [
      {
        texto: "Vou montar o jantar com legumes, sem carne nem peixe.",
        chamadas: [
          {
            nome: "finalizar",
            argumentos: {
              resposta:
                "Para o jantar, legumes cozidos no vapor com abóbora ajudam a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
              sugestoes: [
                {
                  tipo: "refeicao",
                  id: "legumes-assados",
                  motivo: "Legumes cozidos no vapor, sem carne nem peixe.",
                },
              ],
              incertos: [],
            },
          },
        ],
      },
    ],
  },
}
