import { roteiroDemo } from "./demo"
import { roteiroLento } from "./lento"
import { roteiroPerguntaCasa } from "./pergunta-casa"
import { roteiroTextoCru } from "./texto-cru"
import type { Roteiro } from "./tipos"
import { roteiroTroca } from "./troca"

export type { Roteiro } from "./tipos"

// Os roteiros do modo e2e; a mensagem do demo é a sugerida pelo perfil semeado.
export function roteirosDoE2e(mensagemDoDemo: string): Roteiro[] {
  return [
    roteiroDemo(mensagemDoDemo),
    roteiroPerguntaCasa,
    roteiroTroca,
    roteiroTextoCru,
    roteiroLento,
  ]
}
