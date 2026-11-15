import type { envStatus } from "@/infra/env"

export type EnvStatusItem = ReturnType<typeof envStatus>[number]

export type EnvReport = {
  lines: string[]
  exitCode: 0 | 1
}

export function formatEnvStatus(status: EnvStatusItem[], entrega?: number): EnvReport {
  const largura = Math.max(...status.map((item) => item.name.length))

  const lines = status.map(
    (item) =>
      `${item.name.padEnd(largura)}  ${item.presente ? "presente" : "ausente"}  entrega ${item.entrega}  ${item.obrigatoria ? "obrigatória" : "opcional"}`,
  )

  if (entrega === undefined) {
    return { lines, exitCode: 0 }
  }

  const faltantes = status
    .filter((item) => item.obrigatoria && item.entrega <= entrega && !item.presente)
    .map((item) => item.name)

  if (faltantes.length === 0) {
    return { lines, exitCode: 0 }
  }

  return {
    lines: [...lines, `Faltam para a entrega ${entrega}: ${faltantes.join(", ")}`],
    exitCode: 1,
  }
}
