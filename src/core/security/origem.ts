import { config } from "@config/index"

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"])

export function origemValida(p: {
  metodo: string
  origin: string | null
  host: string | null
  caminho?: string
}): boolean {
  if (METODOS_SEGUROS.has(p.metodo.toUpperCase())) return true
  if (!p.origin && p.caminho?.startsWith(config.bastidores.mcp.caminho)) return true
  if (!p.origin || !p.host) return false
  try {
    return new URL(p.origin).host === p.host
  } catch {
    return false
  }
}
