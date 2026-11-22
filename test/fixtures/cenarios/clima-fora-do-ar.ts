import { frioAgitada, roteiroSemParaTer } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Fonte de clima fora do ar (015 T19): clima.agora volta indisponível, sai o log clima_indisponivel e a resposta segue sem o clima.
export const climaForaDoAr: Cenario = {
  nome: "clima-fora-do-ar",
  descricao:
    "Momento do frio-agitada com a fonte de clima fora do ar: clima.agora responde indisponível, sai o log clima_indisponivel e a resposta segue",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: "fora_do_ar",
  mensagem: {
    texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
    atalhos: [],
  },
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
  roteiro: roteiroSemParaTer,
}
