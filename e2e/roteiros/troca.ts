import { type Roteiro, SEM_NADA } from "./tipos"

// Chá de gengibre, que está em casa: a troca do gengibre abre a pergunta do substituto.
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
              "Um chá quente de gengibre aquece sem pesar. Ferva as fatias por alguns minutos, coe e beba morno.",
            sugestoes: [
              {
                tipo: "cha",
                id: "cha-gengibre",
                motivo: "Quente e leve, com o gengibre que você tem em casa.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
}
