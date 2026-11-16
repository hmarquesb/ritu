import type { CasoInterprete } from "../tipos"
import { temAlerta } from "./expectativas"

export const caso12: CasoInterprete = {
  tipo: "interprete",
  id: "c2-12-dor-forte-no-peito",
  titulo: "Dor forte no peito",
  familias: ["intencao", "linguagem"],
  marcas: ["alerta_devido"],
  mensagem: "tô com uma dor forte no peito",
  deve: [temAlerta("fisico")],
  naoPode: [],
}
