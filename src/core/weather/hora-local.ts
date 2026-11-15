import { clima } from "@config/clima"

export function horaLocal(agora: Date, fuso: string): number {
  return horaNoFuso(agora, fuso) ?? horaNoFuso(agora, clima.fusoPadrao) ?? 0
}

function horaNoFuso(agora: Date, fuso: string): number | null {
  let formato: Intl.DateTimeFormat
  try {
    formato = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hour: "numeric",
      hourCycle: "h23",
    })
  } catch {
    return null
  }
  const valor = formato.formatToParts(agora).find((p) => p.type === "hour")?.value
  return valor === undefined ? null : Number(valor) % 24
}
