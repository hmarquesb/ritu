import type { Caminho } from "./ports"

export type { Caminho }

// D2: Interpretacao atende a este tipo sem conversão.
type EntradaDoCaminho = { intencoes: readonly string[]; alerta?: string; suspeito: boolean }

const PRIORITARIAS = ["fora", "ajuda", "ofensa"] as const
const UNICAS = ["casa", "retorno", "evitar"] as const

const ehPrioritaria = (x: string): x is (typeof PRIORITARIAS)[number] =>
  PRIORITARIAS.some((p) => p === x)

const ehUnica = (x: string): x is (typeof UNICAS)[number] => UNICAS.some((u) => u === x)

export function escolherCaminho(i: EntradaDoCaminho): {
  caminho: Exclude<Caminho, "sem_modelo">
  intencoes: string[]
} {
  if (i.alerta) return { caminho: "alerta", intencoes: ["alerta"] }
  if (i.suspeito) return { caminho: "fora", intencoes: ["fora"] }

  const prioritaria = PRIORITARIAS.find((p) => i.intencoes.includes(p))
  if (prioritaria && i.intencoes.every(ehPrioritaria)) {
    return { caminho: prioritaria, intencoes: [prioritaria] }
  }

  const resto = i.intencoes.filter((x) => !ehPrioritaria(x))
  const [unica] = resto
  if (resto.length === 1 && unica && ehUnica(unica)) {
    return { caminho: unica, intencoes: [unica] }
  }

  return { caminho: "acompanhante", intencoes: resto }
}
