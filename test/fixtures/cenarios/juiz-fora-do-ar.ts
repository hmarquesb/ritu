import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// O momento do frio-agitada pela conversa, com o Juiz sem modelo: a entrega vira resposta segura.
export const juizForaDoAr: Cenario = {
  nome: "juiz-fora-do-ar",
  descricao:
    "Momento do frio-agitada pela conversa, com o Juiz sem modelo: a entrega vira resposta segura e a etapa juiz falha",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  faltas: frioAgitada.faltas,
  clima: frioAgitada.clima,
  mensagem: { texto: "Estou com frio e agitada depois do trabalho.", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  juiz: ["sem_modelo"],
  roteiro: frioAgitada.roteiro,
}
