import { envStatus } from "@/infra/env"
import { formatEnvStatus } from "./lib/env-report"

function lerEntrega(argv: readonly string[]): { entrega?: number; erro: boolean } {
  const indice = argv.indexOf("--entrega")
  if (indice === -1) {
    return { erro: false }
  }
  const valor = argv[indice + 1]
  if (valor === undefined || !/^[1-4]$/.test(valor)) {
    return { erro: true }
  }
  return { entrega: Number(valor), erro: false }
}

function main(): number {
  const { entrega, erro } = lerEntrega(process.argv.slice(2))
  if (erro) {
    console.error("Uso: npm run env:check -- --entrega N, com N de 1 a 4.")
    return 2
  }

  const { lines, exitCode } = formatEnvStatus(envStatus(), entrega)
  for (const linha of lines) {
    console.log(linha)
  }
  return exitCode
}

process.exitCode = main()
