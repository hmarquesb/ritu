import type { Cenario } from "./tipos"

export const estomagoPesado: Cenario = {
  nome: "estomago-pesado",
  descricao:
    "Incômodo leve, sem dosha e sem cidade, com evitar da mensagem (amendoim): resposta geral com avisos",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: {},
  casa: [],
  entrada: {
    texto: "Estou com o estômago pesado depois do almoço. Sem amendoim, por favor.",
    intencoes: ["momento"],
    estados: [],
    incomodo: { id: "estomago-pesado" },
    evitar_da_mensagem: ["amendoim"],
  },
  roteiro: [
    {
      texto: "Vou ver o clima de agora antes de responder.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
    },
    {
      texto: "Vou responder com cuidado, sem sugerir nada pesado.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com o estômago pesado, vale descansar, beber água morna aos goles e comer algo leve e morno na próxima refeição. Ainda não sei o que há na sua casa, então não sugiro nada específico agora.",
            sugestoes: [],
            incertos: ["Não sei o que há na sua casa."],
          },
        },
      ],
    },
  ],
}
