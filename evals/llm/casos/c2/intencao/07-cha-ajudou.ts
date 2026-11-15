import type { CasoInterprete } from "../tipos"
import { retorno, temIntencao } from "./expectativas"

export const caso07: CasoInterprete = {
  tipo: "interprete",
  id: "c2-07-cha-ajudou",
  titulo: "Tomou o chá e melhorou",
  mensagem: "tomei o chá e melhorei",
  pendentes: [
    { tipo: "cha", titulo: "Chá de gengibre com canela" },
    { tipo: "refeicao", titulo: "Arroz bem cozido com abóbora e ghee" },
  ],
  deve: [temIntencao("retorno"), retorno("ajudou", 1)],
  naoPode: [],
}
