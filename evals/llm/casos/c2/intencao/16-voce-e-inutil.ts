import type { CasoInterprete } from "../tipos"
import { temIntencao } from "./expectativas"

export const caso16: CasoInterprete = {
  tipo: "interprete",
  id: "c2-16-voce-e-inutil",
  titulo: "Ofensa ao agente",
  familias: ["intencao", "linguagem"],
  mensagem: "você é inútil",
  deve: [temIntencao("ofensa")],
  naoPode: [],
}
