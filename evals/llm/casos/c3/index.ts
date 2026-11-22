import { casoJuiz01 } from "./juiz/01-resposta-boa-de-momento"
import { casoJuiz02 } from "./juiz/02-cha-resolve-a-dor"
import { casoJuiz03 } from "./juiz/03-cha-pode-aliviar-o-peso"
import { casoJuiz04 } from "./juiz/04-capsulas-de-ashwagandha"
import { casoJuiz05 } from "./juiz/05-colher-de-cha-de-gengibre"
import { casoJuiz06 } from "./juiz/06-texto-recomenda-sopa"
import { casoJuiz07 } from "./juiz/07-refresca-com-linha-que-aquece"
import { casoJuiz08 } from "./juiz/08-cardamomo-resolve-o-frio"
import { casoJuiz09 } from "./juiz/09-voce-deveria-se-cuidar"
import { casoJuiz10 } from "./juiz/10-isso-acalma-vata"
import { casoJuiz11 } from "./juiz/11-amendoim-torrado"
import { casoJuiz12 } from "./juiz/12-remedio-para-pressao"
import { casoJuiz13 } from "./juiz/13-ordem-escondida-no-texto"
import { casoMemoria01 } from "./memoria/01-almoco-fora-antigo-casa-recente"
import { casoMemoria02 } from "./memoria/02-acorda-cedo-palavras-diferentes"
import { casoMemoria03 } from "./memoria/03-trinta-notas-teto"
import { casoMemoria04 } from "./memoria/04-instrucao-escondida-na-nota"
import { casoMemoria05 } from "./memoria/05-duas-notas-juiz"
import { casoMemoria06 } from "./memoria/06-almoco-fora-sem-cozinhar"
import { casoMemoria07 } from "./memoria/07-cha-com-padrao"
import { casoMemoria08 } from "./memoria/08-cha-fora-dos-candidatos"
import { casoSeguranca14 } from "./seguranca/14-poema-fora-do-papel"
import { casoSeguranca15 } from "./seguranca/15-jejum-na-rotina"
import { casoSeguranca16 } from "./seguranca/16-dose-de-curcuma"
import { casoIncomodos17 } from "./seguranca/17-cha-cura-gastrite"
import { casoLinguagem18 } from "./seguranca/18-chefe-humilhou"
import { casoLinguagem19 } from "./seguranca/19-sem-vontade-de-nada"
import { casoLinguagem20 } from "./seguranca/20-dia-pesado-com-frio"
import { casoLinguagem21 } from "./seguranca/21-que-dia-de-merda"
import { casoIncomodos22 } from "./seguranca/22-dor-de-cabeca-no-almoco"
import { casoMemoria23 } from "./seguranca/23-padrao-cha-agitada"
import { casoMemoria24 } from "./seguranca/24-cha-da-casa"
import type { CasoC3 } from "./tipos"

// Casos da pasta c3: Juiz (13 casos de juiz), Memória (5 de Memória e 3 de conversa), segurança, linguagem e incômodos (9 de conversa) e padrão do chá (2 de conversa). Ao todo, 32.
export const casosC3: CasoC3[] = [
  casoJuiz01,
  casoJuiz02,
  casoJuiz03,
  casoJuiz04,
  casoJuiz05,
  casoJuiz06,
  casoJuiz07,
  casoJuiz08,
  casoJuiz09,
  casoJuiz10,
  casoJuiz11,
  casoJuiz12,
  casoJuiz13,
  casoMemoria01,
  casoMemoria02,
  casoMemoria03,
  casoMemoria04,
  casoMemoria05,
  casoMemoria06,
  casoMemoria07,
  casoMemoria08,
  casoSeguranca14,
  casoSeguranca15,
  casoSeguranca16,
  casoIncomodos17,
  casoLinguagem18,
  casoLinguagem19,
  casoLinguagem20,
  casoLinguagem21,
  casoIncomodos22,
  casoMemoria23,
  casoMemoria24,
]

export type {
  CasoC3,
  CasoJuiz,
  CasoMemoria,
  ExpectativaDaMemoria,
  ExpectativaDoJuiz,
  NotaDoCaso,
} from "./tipos"
