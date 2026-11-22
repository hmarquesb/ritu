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
                "Para uma manhã fria e agitada, uma refeição morna de caldo e um banho morno ajudam a aquecer e a assentar. Se puder, sente-se para comer, sem tela.",
              sugestoes: [
                {
                  tipo: "pratica",
                  id: "banho-morno",
                  motivo: "Aquece o corpo logo cedo, com o que você tem em casa.",
                },
                {
                  tipo: "refeicao",
                  id: "caldo",
                  motivo: "Uma comida morna e cozida, que assenta bem no frio.",
                },
              ],
              incertos: [],
              para_ter: true,
            },
          },
        ],
      },
    ],
  }
}
