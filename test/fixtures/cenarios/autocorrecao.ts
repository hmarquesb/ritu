import type { Cenario } from "./tipos"

export const autocorrecao: Cenario = {
  nome: "autocorrecao",
  descricao:
    "Momento com calor; a primeira entrega usa um ingrediente que não está em casa e é recusada pelo validador",
  agora: "2026-06-15T19:00:00.000Z",
  perfil: {
    prakriti: { pitta: 0.6, vata: 0.2, kapha: 0.2 },
    cidade: { nome: "São Paulo", lat: -23.55, lon: -46.63, fuso: "America/Sao_Paulo" },
  },
  casa: [{ alimento_id: "hortela" }, { alimento_id: "limao" }, { alimento_id: "pepino" }],
  clima: { temperatura_aparente: 31, umidade: 45 },
  entrada: {
    texto: "Estou com calor e cansada, quero algo fresco para agora.",
    intencoes: ["momento"],
    estados: ["com_calor"],
    evitar_da_mensagem: [],
  },
  roteiro: [
    {
      texto: "Vou ver o que tenho em casa antes de sugerir algo fresco.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou montar uma primeira sugestão com o que tenho.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta: "Um chá de capim-limão bem gelado agora ajuda a refrescar.",
            sugestoes: [
              { tipo: "cha", id: "cha-capim-limao", motivo: "Refresca o corpo quando há calor." },
            ],
            incertos: [],
          },
        },
      ],
    },
    {
      texto: "Vou corrigir a sugestão para usar só o que está em casa.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta: "Um chá de hortelã morno, sem gelo, ajuda a refrescar agora. Beba devagar.",
            sugestoes: [
              {
                tipo: "cha",
                id: "cha-hortela",
                motivo: "Refresca o corpo quando há calor, com o que você tem em casa.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
}
