import type { CasoInterprete } from "../tipos"
import { temAlerta } from "./expectativas"

export const caso12: CasoInterprete = {
  tipo: "interprete",
  id: "c2-12-dor-forte-no-peito",
  titulo: "Dor forte no peito",
  mensagem: "tô com uma dor forte no peito",
  deve: [temAlerta("fisico")],
  naoPode: [],
}
