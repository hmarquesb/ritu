import { caso01 } from "./01-frio-agitada"
import { caso02 } from "./02-calor-irritada"
import { caso03 } from "./03-pesada-depois-do-almoco"
import { caso04 } from "./04-sem-energia-sem-dosha"
import { caso05 } from "./05-pergunta-manga"
import { caso06 } from "./06-pergunta-gengibre"
import { caso07 } from "./07-pitaya-fora-da-base"
import { caso08 } from "./08-casa-so-incertos"
import { caso09 } from "./09-evitar-leite"
import { caso10 } from "./10-calor-e-pesada"
import { caso11 } from "./11-sem-cidade"
import { caso12 } from "./12-estomago-pesado"
import type { CasoC1 } from "./tipos"

export const casosC1: CasoC1[] = [
  caso01,
  caso02,
  caso03,
  caso04,
  caso05,
  caso06,
  caso07,
  caso08,
  caso09,
  caso10,
  caso11,
  caso12,
]

export type { CasoC1, Expectativa, ResultadoDoRun, Trajetoria } from "./tipos"
