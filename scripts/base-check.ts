import { type DemoSeed, validarSeed } from "@/core/demo-seed"
import {
  createKnowledgeBase,
  type KnowledgeBase,
  KnowledgeInvalidError,
  validarBase,
} from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { readDemoSeed, readKnowledgeData } from "@/infra/container"
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

function kbDe(dados: DadosDaBase): KnowledgeBase | undefined {
  try {
    return createKnowledgeBase(dados)
  } catch (erro) {
    if (erro instanceof KnowledgeInvalidError) return undefined
    throw erro
  }
}

function lerSeed(): { seed?: DemoSeed; erros: string[] } {
  try {
    return { seed: readDemoSeed(), erros: [] }
  } catch (erro) {
    if (!(erro instanceof KnowledgeInvalidError)) throw erro
    return { erros: erro.erros }
  }
}

// Devolve as linhas do seed; sem erro, só "ok".
function linhasDoSeed(dados: DadosDaBase): { linhas: string[]; ok: boolean } {
  const { seed, erros } = lerSeed()
  if (seed === undefined) return { linhas: erros, ok: false }
  const kb = kbDe(dados)
  if (kb === undefined) return { linhas: ["base inválida, seed não conferido"], ok: false }
  const achados = validarSeed(seed, kb, new Date())
  return achados.length === 0 ? { linhas: ["ok"], ok: true } : { linhas: achados, ok: false }
}

function main(): number {
  const producao = process.argv.slice(2).includes("--producao")
  const dados = lerDados()
  if (dados === undefined) return 1

  const { lines, exitCode } = formatBaseReport(validarBase(dados), dados, producao)
  for (const linha of lines) {
    console.log(linha)
  }

  const seed = linhasDoSeed(dados)
  for (const linha of seed.linhas) {
    console.log(`seed: ${linha}`)
  }
  return exitCode === 0 && seed.ok ? 0 : 1
}

process.exitCode = main()
