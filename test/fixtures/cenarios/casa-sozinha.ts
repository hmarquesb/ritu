import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Mensagem que só diz o que chegou em casa: caminho `casa`, sem passo do agente.
export const casaSozinha: Cenario = {
  nome: "casa-sozinha",
  descricao:
    "Compras da feira (abóbora e couve da base, pitaia fora da base): caminho casa, anotação, nenhum passo do agente",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "fui à feira, trouxe abóbora, couve e pitaia", atalhos: [] },
  interpretacao: {
    intencoes: ["casa"],
    estados: [],
    itens_casa: [
      { nome: "abóbora", acao: "tem" },
      { nome: "couve", acao: "tem" },
      { nome: "pitaia", acao: "tem" },
    ],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [],
}
