import type { CasoInterprete } from "../tipos"
import { caminho, temIntencao, temUmaDe } from "./expectativas"

export const caso06: CasoInterprete = {
  tipo: "interprete",
  id: "c2-06-abobora-o-que-faco",
  titulo: "Comprou abóbora e pergunta o que fazer",
  mensagem: "comprei abóbora, o que faço com ela hoje?",
  deve: [temIntencao("casa"), temUmaDe("momento", "pergunta"), caminho("acompanhante")],
  naoPode: [],
}
