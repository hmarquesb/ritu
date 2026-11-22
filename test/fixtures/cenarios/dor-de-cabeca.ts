import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Dor de cabeça sem variante dita: a pergunta da variante sai por código, antes do agente; depois o agente dá o aviso de incômodo.
export const dorDeCabeca: Cenario = {
  nome: "dor-de-cabeca",
  descricao:
    "Dor de cabeça sem variante: pausa de código com a pergunta da variante, depois clima e finalizar com o aviso de incômodo",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "tô com dor de cabeça, o que como no almoço?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: [],
    incomodo: { id: "dor-de-cabeca" },
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  respostas: [{ tipo: "variante", variante: "latejante" }],
  roteiro: [
    {
      texto: "Vou ver o clima de agora antes de responder.",
      chamadas: [{ nome: "clima.agora", argumentos: {} }],
    },
    {
      texto: "Vou responder com cuidado, sem sugerir nada picante ou quente.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com essa dor de cabeça latejante, vale evitar picantes, frituras e sol forte no almoço. Escolha algo leve e morno, e beba água aos goles. Se a dor for forte ou continuar, procure uma pessoa de saúde.",
            sugestoes: [],
            incertos: ["Não sei o que há na sua casa."],
          },
        },
      ],
    },
  ],
}
