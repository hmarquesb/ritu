import { type Roteiro, SEM_NADA } from "./tipos"

const DEMORA_MS = 300

// Cada passo demora de verdade, para a tela mostrar as etapas chegando e dar tempo de recarregar no meio.
export const roteiroLento: Roteiro = {
  nome: "lento",
  mensagem: "demora um pouco",
  interpretacao: { ...SEM_NADA, intencoes: ["momento"], estados: ["com_frio"] },
  passos: [
    {
      texto: "Vou ver o clima de agora antes de sugerir.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
      demoraMs: DEMORA_MS,
    },
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
      demoraMs: DEMORA_MS,
    },
    {
      texto: "Vou montar a resposta com o que encontrei.",
      demoraMs: DEMORA_MS,
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Um chá quente de gengibre com canela ajuda a aquecer sem pesar. Beba morno, devagar.",
            explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
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
                motivo: "Aquece o corpo, com o que você tem em casa.",
                linhas_base: ["praticas:cha-gengibre-canela"],
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
