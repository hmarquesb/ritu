const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"])

export function origemValida(p: {
  metodo: string
  origin: string | null
  host: string | null
}): boolean {
  if (METODOS_SEGUROS.has(p.metodo.toUpperCase())) return true
  if (!p.origin || !p.host) return false
  try {
    return new URL(p.origin).host === p.host
  } catch {
    return false
  }
}
