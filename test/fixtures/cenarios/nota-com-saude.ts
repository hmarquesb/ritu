import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

export const RESPOSTA_DA_NOTA =
  "Para hoje, vale uma refeição leve e morna, sentada e sem tela. Se tiver dúvidas sobre o remédio, fale com quem acompanha a sua saúde."

// Remédio de pressão dito de passagem: o agente propõe a rotina, o Juiz aponta saúde na proposta e a linha sai do bloco.
export const notaComSaude: Cenario = {
  nome: "nota-com-saude",
  descricao:
    "Remédio de pressão dito de passagem: o agente propõe a rotina, o Juiz aponta saúde na proposta, a linha sai do bloco e a resposta é entregue",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "tô tomando remédio pra pressão toda manhã, o que como hoje?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    fato_de_rotina: "você toma remédio para pressão toda manhã",
    suspeito: false,
  },
  juiz: [{ apontamentos: [{ motivo: "saude_na_proposta", trecho: "remédio para pressão" }] }],
  roteiro: [
    {
      texto: "Vou anotar a rotina, se a pessoa quiser guardar.",
      chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
    },
    {
      texto: "Vou responder com o que ouvi.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta: RESPOSTA_DA_NOTA,
            explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
            sugestoes: [],
            evitar: [],
            incertos: ["Não sei o que há na sua casa."],
            citados: [],
          },
        },
      ],
    },
  ],
}
