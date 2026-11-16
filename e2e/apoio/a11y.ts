import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

const NIVEIS_BLOQUEANTES = ["serious", "critical"]
const TAGS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

// Roda o axe com as regras WCAG 2.2 AA e falha se houver violação grave ou crítica.
export async function expectSemViolacoes(
  page: Page,
  opcoes: { excluir?: string[] } = {},
): Promise<void> {
  let axe = new AxeBuilder({ page }).withTags(TAGS_WCAG)
  for (const seletor of opcoes.excluir ?? []) {
    axe = axe.exclude(seletor)
  }
  const resultado = await axe.analyze()

  const bloqueantes = resultado.violations.filter(
    (v) => v.impact && NIVEIS_BLOQUEANTES.includes(v.impact),
  )
  if (bloqueantes.length === 0) return

  const linhas = bloqueantes.flatMap((v) =>
    v.nodes.map((no) => `- regra ${v.id} · impacto ${v.impact} · seletor ${no.target.join(" ")}`),
  )
  throw new Error(`Violações de acessibilidade:\n${linhas.join("\n")}`)
}
