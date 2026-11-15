import { config } from "@config/index"

const DIA_EM_MS = 86_400_000

export function diaLocal(agora: Date, fuso?: string): string {
  const formato = formatoDoDia(fuso ?? config.clima.fusoPadrao)
  return formato.format(agora)
}

export function diasAtras(dia: string, n: number): string {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number)
  const base = Date.UTC(ano ?? 0, (mes ?? 1) - 1, diaDoMes ?? 1)
  return new Date(base - n * DIA_EM_MS).toISOString().slice(0, 10)
}

function formatoDoDia(fuso: string): Intl.DateTimeFormat {
  try {
    return criarFormato(fuso)
  } catch (erro) {
    if (erro instanceof RangeError) return criarFormato(config.clima.fusoPadrao)
    throw erro
  }
}

function criarFormato(fuso: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}
