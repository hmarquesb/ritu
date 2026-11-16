import { checkpoints } from "../checkpoints"
import { type CasoC1, casosC1 } from "./c1"
import { type CasoC2, type CasoConversa, type CasoInterprete, casosC2 } from "./c2"
import { type CasoC3, type CasoJuiz, type CasoMemoria, casosC3 } from "./c3"

export type CasoDeEval = CasoC1 | CasoC2 | CasoC3
export type NomeDoCheckpoint = keyof typeof checkpoints

export type { CasoC1, CasoC2, CasoC3, CasoConversa, CasoInterprete, CasoJuiz, CasoMemoria }

type Pasta = "c1" | "c2" | "c3"

const CASOS_DA_PASTA: Record<Pasta, CasoDeEval[]> = {
  c1: casosC1,
  c2: casosC2,
  c3: casosC3,
}

// Os casos do checkpoint: na ordem das pastas de `checkpoints.ts` e, dentro da pasta, do id (D21).
export function casosDoCheckpoint(nome: NomeDoCheckpoint): CasoDeEval[] {
  const pastas: readonly Pasta[] = checkpoints[nome]
  return pastas.flatMap((pasta) =>
    [...CASOS_DA_PASTA[pasta]].sort((a, b) => a.id.localeCompare(b.id)),
  )
}
