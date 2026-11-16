import { casoAprendizado01 } from "./aprendizado/01-cha-nao-ajudou-duas-vezes"
import { casoAprendizado02 } from "./aprendizado/02-nao-gosto-nao-aparece"
import { casoAprendizado03 } from "./aprendizado/03-gosto-aparece"
import { casoAprendizado04 } from "./aprendizado/04-retorno-de-ontem-fechado"
import { casoAprendizado05 } from "./aprendizado/05-melhorei-sem-pista-como-ficou"
import { caso01 } from "./intencao/01-frio-sem-fome"
import { caso02 } from "./intencao/02-manga-pergunta-pitta"
import { caso03 } from "./intencao/03-almoco-fora-na-semana"
import { caso04 } from "./intencao/04-feira-abobora-couve"
import { caso05 } from "./intencao/05-acabou-arroz"
import { caso06 } from "./intencao/06-abobora-o-que-faco"
import { caso07 } from "./intencao/07-cha-ajudou"
import { caso08 } from "./intencao/08-ontem-otimo"
import { caso09 } from "./intencao/09-cha-nao-adiantou"
import { caso10 } from "./intencao/10-alergia-camarao"
import { caso11 } from "./intencao/11-dor-de-cabeca-almoco"
import { caso12 } from "./intencao/12-dor-forte-no-peito"
import { caso13 } from "./intencao/13-queria-sumir"
import { caso14 } from "./intencao/14-dia-pesado-pra-baixo"
import { caso15 } from "./intencao/15-cansaco-sem-energia"
import { caso16 } from "./intencao/16-voce-e-inutil"
import { caso17 } from "./intencao/17-prompt-suspeito"
import { caso18 } from "./intencao/18-apagar-dados"
import { caso19 } from "./intencao/19-vegetariana"
import { caso20 } from "./intencao/20-nao-como-coentro"
import { casoParaTer06 } from "./para-ter/06-para-ter-com-faltas"
import { casoParaTer07 } from "./para-ter/07-sem-candidato"
import { casoParaTer08 } from "./para-ter/08-incomodo-sem-para-ter"
import { casoPergunta01 } from "./perguntas/01-frio-so-incertos"
import { casoPergunta02 } from "./perguntas/02-frio-casa-confirmada"
import { casoPergunta03 } from "./perguntas/03-almoco-casa-vazia"
import { casoPergunta04 } from "./perguntas/04-pergunta-manga"
import { casoPergunta05 } from "./perguntas/05-frio-nao-tenho-a-tudo"
import { casoPergunta06 } from "./perguntas/06-frio-nao-gosto-a-um"
import { casoPergunta07 } from "./perguntas/07-frio-evitar-sempre"
import { casoPergunta08 } from "./perguntas/08-dor-de-cabeca-latejante"
import { casoPropostas01 } from "./propostas/01-almoco-fora-propoe"
import { casoPropostas02 } from "./propostas/02-dia-corrido-nenhuma"
import { casoPropostas03 } from "./propostas/03-nao-tenho-um-item"
import { casoPropostas04 } from "./propostas/04-item-ausente-sem-pergunta"
import { casoPropostas05 } from "./propostas/05-vegetariana-sem-barrado"
import { casoPropostas06 } from "./propostas/06-almoco-fora-nao-diz-que-anotou"
import type { CasoC2 } from "./tipos"

// Casos da pasta c2 (Intérprete e conversa). A família Intenção tem 20 casos do Intérprete; as famílias Perguntas (8), Propostas (6), Aprendizado (5) e Para ter em casa (3), casos de conversa.
export const casosC2: CasoC2[] = [
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
  caso13,
  caso14,
  caso15,
  caso16,
  caso17,
  caso18,
  caso19,
  caso20,
  casoPergunta01,
  casoPergunta02,
  casoPergunta03,
  casoPergunta04,
  casoPergunta05,
  casoPergunta06,
  casoPergunta07,
  casoPergunta08,
  casoPropostas01,
  casoPropostas02,
  casoPropostas03,
  casoPropostas04,
  casoPropostas05,
  casoPropostas06,
  casoAprendizado01,
  casoAprendizado02,
  casoAprendizado03,
  casoAprendizado04,
  casoAprendizado05,
  casoParaTer06,
  casoParaTer07,
  casoParaTer08,
]

export type {
  CasoC2,
  CasoConversa,
  CasoInterprete,
  ExpectativaDaConversa,
  ExpectativaDoInterprete,
} from "./tipos"
