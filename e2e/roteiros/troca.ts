import { type Roteiro, SEM_NADA } from "./tipos"

// Chá de canela, que está em casa: trocar a canela abre a pergunta do substituto (cardamomo ou cravo, que não estão em casa).
export const roteiroTroca: Roteiro = {
  nome: "troca",
  mensagem: "quero um chá quente agora",
  interpretacao: { ...SEM_NADA, intencoes: ["momento"], estados: ["com_frio"] },
  passos: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou montar a resposta com o chá.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Um chá quente de canela aquece sem pesar. Ferva um pau de canela por alguns minutos, coe e beba morno.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente"],
            },
            sugestoes: [
              {
                tipo: "cha",
                pratica_id: "cha-canela",
                itens: [
                  {
                    alimento_id: "canela",
                    contribui: ["quente"],
                    linha_base: "alimentos:canela",
                  },
                ],
                motivo: "Quente e leve, com a canela que você tem em casa.",
                linhas_base: ["praticas:cha-canela"],
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
