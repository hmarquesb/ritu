import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Cardamomo confirmado em casa: o toque Trocar na canela do chá sai sem passo do agente.
export const trocaPorToque: Cenario = {
  nome: "troca-por-toque",
  descricao:
    "Momento do frio-agitada com noz-moscada em casa; toque Trocar na canela do chá: troca na hora, retorno com os alimentos novos, nenhuma etapa llm",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: [...frioAgitada.casa, { alimento_id: "noz-moscada" }],
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
  toques: [{ tipo: "troca", sugestao: 0, alimento_id: "canela", motivo: "trocar" }],
  roteiro: [
    {
      texto: "Vou ver o clima de agora antes de sugerir.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
    },
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou conferir se as combinações funcionam juntas.",
      chamadas: [
        {
          nome: "ayurveda.checar_combinacao",
          argumentos: { itens: ["abobora", "arroz-branco", "canela", "gengibre"] },
        },
      ],
    },
    {
      texto: "Vou montar a resposta com o que encontrei.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para este fim de tarde frio e úmido, um chá quente de gengibre com canela e uma refeição morna de arroz com abóbora ajudam a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente", "estavel", "pesado"],
            },
            sugestoes: [
              {
                tipo: "cha",
                pratica_id: "cha-gengibre-canela",
                itens: [
                  {
                    alimento_id: "gengibre",
                    contribui: ["quente"],
                    linha_base: "alimentos:gengibre",
                  },
                  {
                    alimento_id: "canela",
                    contribui: ["quente"],
                    linha_base: "alimentos:canela",
                  },
                ],
                motivo: "Aquece o corpo no fim do dia, com o que você tem em casa.",
                linhas_base: ["praticas:cha-gengibre-canela"],
                novidade: false,
              },
              {
                tipo: "refeicao",
                preparo_id: "arroz-com-legume",
                itens: [
                  {
                    alimento_id: "arroz-branco",
                    funcao: "base",
                    contribui: ["pesado"],
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
              {
                tipo: "pratica",
                pratica_id: "comer-sentada-sem-tela",
                itens: [],
                motivo: "Comer com calma ajuda a sentir o corpo assentar.",
                linhas_base: ["praticas:comer-sentada-sem-tela"],
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
