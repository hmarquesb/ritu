import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Dor forte no peito: o guardrail de código barra antes do Intérprete; a resposta é o texto fixo do alerta, sem modelo.
export const alertaPorCodigo: Cenario = {
  nome: "alerta-por-codigo",
  descricao:
    "Dor forte no peito pega pelo padrão de código: caminho alerta, etapa guardrail com codigo, nenhuma chamada de modelo",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "tô com uma dor forte no peito", atalhos: [] },
  roteiro: [],
}
