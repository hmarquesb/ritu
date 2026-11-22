import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Abóbora e couve incertas (20 dias, validade curta): o agente pergunta; a pessoa tem a abóbora e não tem a couve.
export const casaIncerta: Cenario = {
  nome: "casa-incerta",
  descricao:
    "Abóbora e couve incertas (20 dias): pausa de casa, a pessoa tem a abóbora e não tem a couve, finalizar com a abóbora",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: [
    { alimento_id: "abobora", diasDesdeConfirmacao: 20 },
    { alimento_id: "couve", diasDesdeConfirmacao: 20 },
  ],
  clima: frioAgitada.clima,
  mensagem: { texto: "estou com frio, o que como no jantar?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  respostas: [
    {
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "nao_tenho" },
      ],
    },
  ],
  roteiro: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou confirmar a abóbora e a couve, que estão incertas.",
      chamadas: [
        {
          nome: "ask_user",
          argumentos: { tipo: "casa", alimentos: ["abobora", "couve"] },
        },
      ],
    },
    {
      texto: "Vou montar a resposta com a abóbora.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para um jantar frio, uma refeição morna de abóbora cozida no vapor ajuda a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
            sugestoes: [
              {
                tipo: "refeicao",
                id: "legumes-no-vapor",
                escolhas: [{ funcao: "legume", alimento_id: "abobora" }],
                motivo: "Uma comida morna e cozida, com a abóbora que você confirmou.",
              },
            ],
            incertos: [],
          },
        },
      ],
    },
  ],
}
