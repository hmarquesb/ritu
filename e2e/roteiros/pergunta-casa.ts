import { type Roteiro, SEM_NADA } from "./tipos"

// A banana está incerta no perfil semeado e é a opção de uma refeição candidata: o agente pergunta e, com a resposta, entrega.
// Fixa as 17h30 (relógio fixo nos testes e no modo e2e), quando a refeição de fruta cozida entra nos candidatos.
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
      texto: "Vou confirmar a banana, que está incerta.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["banana"] } }],
    },
    {
      texto: "Vou montar a resposta com uma prática que não depende da banana.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para o jantar, uma pausa em silêncio, antes de comer, assenta a agitação. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio", "movel"],
              qualidades_buscadas: ["quente", "estavel", "pesado"],
            },
            sugestoes: [
              {
                tipo: "pratica",
                pratica_id: "pausa-em-silencio",
                itens: [],
                motivo: "Uma pausa curta acalma a agitação, sem depender do que tem em casa.",
                linhas_base: ["praticas:pausa-em-silencio"],
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
