import type { DadosDaBase } from "@/core/knowledge/schemas"
import type { ResultadoValidacao } from "@/core/knowledge/validate"

export type BaseReport = {
  lines: string[]
  exitCode: 0 | 1
}

function secao(titulo: string, contagens: Record<string, number>): string[] {
  return [titulo, ...Object.entries(contagens).map(([nome, total]) => `  ${nome}: ${total}`)]
}

function linhasDeErro(erros: string[]): string[] {
  if (erros.length === 0) return ["Erros: nenhum"]
  return [`Erros: ${erros.length}`, ...erros.map((erro) => `  - ${erro}`)]
}

function bloqueiosDeProducao(resultado: ResultadoValidacao, dados: DadosDaBase): string[] {
  const bloqueios: string[] = []
  const { aConfirmar } = resultado.contagens
  const naoAprovadas = dados.fontes.filter((fonte) => !fonte.aprovada).length
  if (aConfirmar > 0) bloqueios.push(`${aConfirmar} linha(s) com a_confirmar`)
  if (naoAprovadas > 0) bloqueios.push(`${naoAprovadas} fonte(s) não aprovada(s)`)
  return bloqueios
}

function linhasDeProducao(bloqueios: string[]): string[] {
  if (bloqueios.length === 0) return ["Modo produção: sem bloqueios"]
  return [`Modo produção: bloqueado por ${bloqueios.join(" e ")}`]
}

// Função pura: não lê arquivo nem imprime. O script decide o que mostrar e o código de saída.
export function formatBaseReport(
  resultado: ResultadoValidacao,
  dados: DadosDaBase,
  producao: boolean,
): BaseReport {
  const { contagens } = resultado
  const bloqueios = producao ? bloqueiosDeProducao(resultado, dados) : []

  const lines = [
    ...secao("Registros por arquivo:", contagens.porArquivo),
    ...secao("Alimentos por grupo:", contagens.alimentosPorGrupo),
    ...secao("Práticas por tipo:", contagens.praticasPorTipo),
    `Linhas com a_confirmar: ${contagens.aConfirmar}`,
    ...linhasDeErro(resultado.erros),
    ...(producao ? linhasDeProducao(bloqueios) : []),
  ]

  const temErro = resultado.erros.length > 0 || bloqueios.length > 0
  return { lines, exitCode: temErro ? 1 : 0 }
}
