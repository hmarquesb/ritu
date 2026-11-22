import { type Roteiro, SEM_NADA } from "./tipos"

// Couve e leite estão incertas no perfil semeado: o agente pergunta e, com a resposta, entrega.
export const roteiroPerguntaCasa: Roteiro = {
  nome: "pergunta-casa",
  mensagem: "fui à feira ontem, o que faço pro jantar?",
  interpretacao: { ...SEM_NADA, intencoes: ["momento"], estados: ["com_frio", "agitada"] },
  passos: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou confirmar a couve e o leite, que estão incertas.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["couve", "leite"] } }],
    },
    {
      texto: "Vou montar a resposta com a abóbora.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para o jantar, uma refeição morna de caldo é simples e assenta bem. Se puder, sente-se para comer, sem tela.",
            sugestoes: [
              {
                tipo: "refeicao",
                id: "caldo",
                motivo: "Uma comida morna e cozida, com o que você tem.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
}
