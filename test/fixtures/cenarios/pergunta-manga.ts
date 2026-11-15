import type { Cenario } from "./tipos"

export const perguntaManga: Cenario = {
  nome: "pergunta-manga",
  descricao: 'Pergunta: "manga é boa para Pitta?"',
  agora: "2026-06-15T18:00:00.000Z",
  perfil: {
    prakriti: { vata: 0.2, pitta: 0.6, kapha: 0.2 },
  },
  casa: [],
  entrada: {
    texto: "manga é boa para Pitta?",
    intencoes: ["pergunta"],
    estados: [],
    evitar_da_mensagem: [],
  },
  roteiro: [
    {
      chamadas: [{ nome: "ayurveda.alimento", argumentos: { alimentos: ["manga"] } }],
    },
    {
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Manga costuma ser doce e refrescante, e para Pitta vale comer madura e em pouca quantidade, de preferência em horário de almoço.",
            explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
            sugestoes: [],
            evitar: [],
            incertos: [],
            citados: ["alimentos:manga"],
          },
        },
      ],
    },
  ],
}
