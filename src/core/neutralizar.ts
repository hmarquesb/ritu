const TROCAS: Record<string, string> = { "<": "‹", ">": "›" }

// Troca os colchetes angulares, para que o texto não feche ou abra blocos do prompt.
export function neutralizar(texto: string): string {
  return texto.replace(/[<>]/g, (c) => TROCAS[c] ?? c)
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== "object" || valor === null) return false
  const proto = Object.getPrototypeOf(valor)
  return proto === Object.prototype || proto === null
}

// Neutraliza toda string de um valor (objetos e listas inclusive), sem mudar chaves nem outros tipos.
export function neutralizarProfundo(valor: unknown): unknown {
  if (typeof valor === "string") return neutralizar(valor)
  if (Array.isArray(valor)) return valor.map(neutralizarProfundo)
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, neutralizarProfundo(v)]))
  }
  return valor
}
