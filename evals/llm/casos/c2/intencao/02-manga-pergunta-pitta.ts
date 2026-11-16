import type { CasoInterprete } from "../tipos"
import { semEstados, temIntencao } from "./expectativas"

export const caso02: CasoInterprete = {
  tipo: "interprete",
  id: "c2-02-manga-pergunta-pitta",
  titulo: "Pergunta sobre manga para Pitta",
  familias: ["intencao"],
  mensagem: "manga é boa para Pitta?",
  deve: [temIntencao("pergunta")],
  naoPode: [semEstados()],
}
