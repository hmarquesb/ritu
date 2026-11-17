import { type Roteiro, SEM_NADA } from "./tipos"

// A mensagem sugerida do perfil de demonstração: chá, refeição, o que ter em casa e o padrão no bloco de aprovação.
export function roteiroDemo(mensagem: string): Roteiro {
  return {
    nome: "demo",
    mensagem,
    interpretacao: { ...SEM_NADA, intencoes: ["momento"], estados: ["com_frio", "agitada"] },
    passos: [
      {
        texto: "Vou ver o clima de agora antes de sugerir.",
        chamadas: [{ nome: "clima.agora", argumentos: {} }],
      },
      {
        texto: "Vou conferir o que tenho em casa agora.",
        chamadas: [{ nome: "casa.ler", argumentos: {} }],
      },
      {
        texto: "Vou montar a resposta com o que encontrei.",
        chamadas: [
          {
            nome: "finalizar",
            argumentos: {
              resposta:
                "Para uma manhã fria e agitada, um chá quente de gengibre com canela e uma refeição morna de arroz com abóbora e ghee ajudam a aquecer e a assentar. Se puder, sente-se para comer, sem tela.",
              explicacao: {
                qualidades_do_momento: ["frio", "movel"],
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
                  motivo: "Aquece o corpo logo cedo, com o que você tem em casa.",
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
                    {
                      alimento_id: "ghee",
                      funcao: "gordura",
                      contribui: ["pesado"],
                      linha_base: "alimentos:ghee",
                    },
                  ],
                  motivo: "Uma comida morna e cozida, que assenta bem no frio.",
                  linhas_base: ["preparos:arroz-com-legume"],
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
}
