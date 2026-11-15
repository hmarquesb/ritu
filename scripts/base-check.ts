import { KnowledgeInvalidError, validarBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { readKnowledgeData } from "@/infra/container"
import { formatBaseReport } from "./lib/base-report"

function lerDados(): DadosDaBase | undefined {
  try {
    return readKnowledgeData()
  } catch (erro) {
    if (!(erro instanceof KnowledgeInvalidError)) throw erro
    for (const linha of erro.erros) {
      console.error(linha)
    }
    return undefined
  }
}

function main(): number {
  const producao = process.argv.slice(2).includes("--producao")
  const dados = lerDados()
  if (dados === undefined) return 1

  const { lines, exitCode } = formatBaseReport(validarBase(dados), dados, producao)
  for (const linha of lines) {
    console.log(linha)
  }
  return exitCode
}

process.exitCode = main()
