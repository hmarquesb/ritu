import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Só atalhos, sem texto: sem Intérprete, o roteiro é o do frio-agitada.
export const soAtalhos: Cenario = {
  nome: "so-atalhos",
  descricao: "Só 🥶 e ⚡, sem texto: sem Intérprete, roteiro do frio-agitada",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  faltas: frioAgitada.faltas,
  clima: frioAgitada.clima,
  mensagem: { atalhos: ["com_frio", "agitada"] },
  roteiro: frioAgitada.roteiro,
}
