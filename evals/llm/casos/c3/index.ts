import { casoMemoria01 } from "./memoria/01-almoco-fora-antigo-casa-recente"
import { casoMemoria02 } from "./memoria/02-acorda-cedo-palavras-diferentes"
import { casoMemoria03 } from "./memoria/03-trinta-notas-teto"
import { casoMemoria04 } from "./memoria/04-instrucao-escondida-na-nota"
import { casoMemoria05 } from "./memoria/05-duas-notas-juiz"
import { casoMemoria06 } from "./memoria/06-almoco-fora-sem-cozinhar"
import { casoMemoria07 } from "./memoria/07-cha-com-padrao"
import { casoMemoria08 } from "./memoria/08-cha-fora-dos-candidatos"
import type { CasoC3 } from "./tipos"

// Casos da pasta c3 (Memória e as famílias de conversa do c3). A família Memória tem 5 casos de Memória e 3 de conversa.
export const casosC3: CasoC3[] = [
  casoMemoria01,
  casoMemoria02,
  casoMemoria03,
  casoMemoria04,
  casoMemoria05,
  casoMemoria06,
  casoMemoria07,
  casoMemoria08,
]

export type {
  CasoC3,
  CasoJuiz,
  CasoMemoria,
  ExpectativaDaMemoria,
  ExpectativaDoJuiz,
  NotaDoCaso,
} from "./tipos"
