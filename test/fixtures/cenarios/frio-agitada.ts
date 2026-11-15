import type { Cenario } from "./tipos"

export const frioAgitada: Cenario = {
  nome: "frio-agitada",
  descricao:
    "Momento com texto, Vata-Pitta, Rio com frio e úmido, casa com abóbora, arroz, ghee, gengibre e canela, cardamomo com falta em 3 dias",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: {
    prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
    cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
  },
  casa: [
    { alimento_id: "abobora" },
    { alimento_id: "arroz-branco" },
    { alimento_id: "ghee" },
    { alimento_id: "gengibre" },
    { alimento_id: "canela" },
  ],
  faltas: [
    { alimento_id: "cardamomo", diasAtras: 1 },
    { alimento_id: "cardamomo", diasAtras: 2 },
    { alimento_id: "cardamomo", diasAtras: 3 },
  ],
  clima: { temperatura_aparente: 16, umidade: 88 },
  entrada: {
    texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    evitar_da_mensagem: [],
  },
  roteiro: [
    { chamadas: [{ nome: "clima.agora", argumentos: {} }] },
    { chamadas: [{ nome: "casa.ler", argumentos: {} }] },
    {
      chamadas: [
        {
          nome: "ayurveda.checar_combinacao",
          argumentos: { itens: ["abobora", "arroz-branco", "canela", "gengibre"] },
        },
      ],
    },
    {
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
            para_ter: {
              alimento_id: "cardamomo",
              vezes: 3,
              contribui: ["quente"],
              linha_base: "alimentos:cardamomo",
            },
          },
        },
      ],
    },
  ],
}
