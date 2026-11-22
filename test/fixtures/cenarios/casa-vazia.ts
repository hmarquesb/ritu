import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Primeira conversa, nada em Minha casa: a refeição depende de perguntas; a pessoa tem três itens, não gosta de um e pula outro.
export const casaVazia: Cenario = {
  nome: "casa-vazia",
  descricao:
    "Primeira conversa, casa vazia: ask_user com 5 itens de uma refeição (três Tenho, um Não gosto, um pulado), finalizar com a refeição feita do que ela tem",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: [],
  clima: frioAgitada.clima,
  mensagem: {
    texto: "estou com frio e agitada depois do trabalho, o que como no almoço?",
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
  respostas: [
    {
      tipo: "casa",
      itens: [
        { alimento_id: "mandioca", resposta: "tenho" },
        { alimento_id: "batata-doce", resposta: "tenho" },
        { alimento_id: "inhame", resposta: "tenho" },
        { alimento_id: "ghee", resposta: "nao_gosto" },
      ],
    },
  ],
  roteiro: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou conferir os ingredientes de uma refeição morna que depende da casa.",
      chamadas: [
        {
          nome: "ask_user",
          argumentos: {
            tipo: "casa",
            alimentos: ["mandioca", "batata-doce", "inhame", "ghee", "azeite"],
          },
        },
      ],
    },
    {
      texto: "Vou montar a resposta com a mandioca que você tem.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para este fim de tarde frio, um purê de mandioca morno ajuda a aquecer sem pesar demais. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente", "estavel", "pesado"],
            },
            sugestoes: [
              {
                tipo: "refeicao",
                preparo_id: "pure-de-raiz",
                itens: [
                  {
                    alimento_id: "mandioca",
                    funcao: "base",
                    contribui: ["pesado"],
                    linha_base: "alimentos:mandioca",
                  },
                ],
                motivo: "Uma comida morna e cozida, com a mandioca que você tem em casa.",
                linhas_base: ["preparos:pure-de-raiz"],
                novidade: false,
              },
            ],
            evitar: ["estados:com_frio"],
            incertos: [],
            citados: [],
          },
        },
      ],
    },
  ],
}
