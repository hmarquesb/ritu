export type ParTema = { light: string; dark: string }

// Uma linha de token: `--ritu-<nome>: light-dark(<args>);`
const LINHA_TOKEN = /^\s*--ritu-([a-z0-9-]+):\s*light-dark\((.+)\);\s*$/

// Um hexadecimal de seis dígitos (maiúsculas ou minúsculas).
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/**
 * Lê `tokens.css` e devolve, por nome, a cor do tema claro e a do escuro.
 * Só as linhas `--ritu-<nome>: light-dark(a, b)`; outras variáveis são ignoradas.
 */
export function parseTokens(css: string): Record<string, ParTema> {
  const tokens: Record<string, ParTema> = {}
  for (const linha of css.split("\n")) {
    const casa = LINHA_TOKEN.exec(linha)
    if (!casa) continue
    const [light, dark] = dividirArgumentos(casa[2] ?? "")
    tokens[casa[1] ?? ""] = { light: light ?? "", dark: dark ?? "" }
  }
  return tokens
}

/** Razão de contraste WCAG 2.x entre duas cores `#RRGGBB`. Vai de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  const claro = Math.max(la, lb)
  const escuro = Math.min(la, lb)
  return (claro + 0.05) / (escuro + 0.05)
}

// Separa os argumentos na vírgula de nível zero, respeitando parênteses internos (ex.: a função de cor de scrim).
function dividirArgumentos(args: string): string[] {
  const partes: string[] = []
  let profundidade = 0
  let atual = ""
  for (const caractere of args) {
    if (caractere === "(") profundidade++
    if (caractere === ")") profundidade--
    if (caractere === "," && profundidade === 0) {
      partes.push(atual.trim())
      atual = ""
    } else {
      atual += caractere
    }
  }
  partes.push(atual.trim())
  return partes
}

function luminancia(cor: string): number {
  const casa = HEX.exec(cor.trim())
  if (!casa) throw new Error(`cor não suportada para contraste: ${cor}`)
  const [R, G, B] = [casa[1], casa[2], casa[3]].map((par) =>
    canal(Number.parseInt(par ?? "0", 16) / 255),
  )
  return 0.2126 * (R ?? 0) + 0.7152 * (G ?? 0) + 0.0722 * (B ?? 0)
}

function canal(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
