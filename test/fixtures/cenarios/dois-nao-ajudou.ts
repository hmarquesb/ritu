import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Dois retornos do mesmo chá, em dias diferentes, ambos "não ajudou": no preparo seguinte o chá vai para o fim do seu tipo.
export const doisNaoAjudou: Cenario = {
  nome: "dois-nao-ajudou",
  descricao:
    "Dois toques Não ajudou no mesmo chá (retornos semeados de dias diferentes); a mensagem seguinte põe o chá no fim do seu tipo",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  retornos: [
    {
      sugestao: {
        tipo: "cha",
        pratica_id: "cha-gengibre",
        alimentos: ["gengibre"],
        titulo: "Chá de gengibre",
      },
      diasAtras: 2,
    },
    {
      sugestao: {
        tipo: "cha",
        pratica_id: "cha-gengibre",
        alimentos: ["gengibre"],
        titulo: "Chá de gengibre",
      },
      diasAtras: 1,
    },
  ],
  mensagem: { texto: "estou com frio, o que como no jantar?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  toques: [
    { tipo: "retorno", sugestao: 0, resultado: "nao_ajudou", semeado: true },
    { tipo: "retorno", sugestao: 1, resultado: "nao_ajudou", semeado: true },
  ],
  depois: {
    mensagem: { texto: "e agora, depois do jantar, o que tomo?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: ["com_frio"],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
    roteiro: [
      {
        texto: "Vou conferir o que tenho em casa agora.",
        chamadas: [{ nome: "casa.ler", argumentos: {} }],
      },
      {
        texto: "Vou montar a resposta com o que tenho em casa.",
        chamadas: [
          {
            nome: "finalizar",
            argumentos: {
              resposta:
                "Para depois do jantar, uma refeição morna de arroz com abóbora assenta bem no frio. Se puder, sente-se para comer, sem tela.",
              explicacao: {
                qualidades_do_momento: ["frio"],
                qualidades_buscadas: ["quente"],
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
                  motivo: "Uma comida morna e cozida, que assenta bem no frio.",
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
  },
  roteiro: [
    {
      texto: "Vou montar a resposta com uma prática simples.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para agora, o mais simples é sentar, respirar e comer com calma. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente"],
            },
            sugestoes: [
              {
                tipo: "pratica",
                pratica_id: "comer-sentada-sem-tela",
                itens: [],
                motivo: "Comer com calma ajuda a sentir o corpo assentar.",
                linhas_base: ["praticas:comer-sentada-sem-tela"],
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
}
