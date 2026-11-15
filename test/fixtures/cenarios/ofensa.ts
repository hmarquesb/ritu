import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Ofensa sozinha: caminho ofensa, texto curto e fixo.
export const ofensa: Cenario = {
  nome: "ofensa",
  descricao: "Ofensa sem pedido: caminho ofensa, texto curto",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "você é inútil", atalhos: [] },
  interpretacao: {
    intencoes: ["ofensa"],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [],
}
