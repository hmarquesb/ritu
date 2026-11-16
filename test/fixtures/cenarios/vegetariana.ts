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
            explicacao: {
              qualidades_do_momento: [],
              qualidades_buscadas: [],
            },
            sugestoes: [
              {
                tipo: "refeicao",
                preparo_id: "arroz-com-legume",
                itens: [
                  {
                    alimento_id: "arroz-branco",
                    funcao: "base",
                    contribui: [],
                    linha_base: "alimentos:arroz-branco",
                  },
                  {
                    alimento_id: "abobora",
                    funcao: "legume",
                    contribui: [],
                    linha_base: "alimentos:abobora",
                  },
                ],
                motivo: "Uma comida morna e cozida, sem carne nem peixe.",
                linhas_base: ["preparos:arroz-com-legume"],
                novidade: false,
              },
            ],
            evitar: [],
            incertos: [],
            citados: [],
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
              explicacao: {
                qualidades_do_momento: [],
                qualidades_buscadas: [],
              },
              sugestoes: [
                {
                  tipo: "refeicao",
                  preparo_id: "legumes-no-vapor",
                  itens: [
                    {
                      alimento_id: "abobora",
                      funcao: "legume",
                      contribui: [],
                      linha_base: "alimentos:abobora",
                    },
                  ],
                  motivo: "Legumes cozidos no vapor, sem carne nem peixe.",
                  linhas_base: ["preparos:legumes-no-vapor"],
                  novidade: false,
                },
              ],
              evitar: [],
              incertos: [],
              citados: [],
            },
          },
        ],
      },
    ],
  },
}
