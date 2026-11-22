import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Duas linhas no bloco, casa e rotina: a pessoa aprova só a da casa, e a rotina fica de fora.
export const aprovacaoParcial: Cenario = {
  nome: "aprovacao-parcial",
  descricao:
    "Compra de abóbora e rotina da semana: bloco com duas linhas (casa, rotina), aprova só a da casa",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa.filter((item) => item.alimento_id !== "abobora"),
  clima: frioAgitada.clima,
  mensagem: {
    texto: "essa semana vou almoçar fora todo dia, e comprei abóbora",
    atalhos: [],
  },
  interpretacao: {
    intencoes: ["vida", "casa"],
    estados: [],
    itens_casa: [{ nome: "abóbora", acao: "tem" }],
    fato_de_rotina: "essa semana você vai almoçar fora todo dia",
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: [
    {
      texto: "Vou anotar a rotina da semana, se a pessoa quiser guardar.",
      chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
    },
    {
      texto: "Vou responder com o que ouvi.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com as refeições fora essa semana, vale deixar à mão o que você trouxe da feira. Se puder, sente-se para comer, sem tela.",
            sugestoes: [],
            incertos: [],
          },
        },
      ],
    },
  ],
}
