import type { CasoInterprete } from "../tipos"
import { itemDeCasa, temIntencao } from "./expectativas"

export const caso04: CasoInterprete = {
  tipo: "interprete",
  id: "c2-04-feira-abobora-couve",
  titulo: "Fui à feira e trouxe abóbora e couve",
  mensagem: "fui à feira, trouxe abóbora e couve",
  deve: [temIntencao("casa"), itemDeCasa("abobora", "tem"), itemDeCasa("couve", "tem")],
  naoPode: [],
}
