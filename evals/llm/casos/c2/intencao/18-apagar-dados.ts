import type { CasoInterprete } from "../tipos"
import { naoCaminho, temIntencao } from "./expectativas"

export const caso18: CasoInterprete = {
  tipo: "interprete",
  id: "c2-18-apagar-dados",
  titulo: "Pergunta como apagar os dados",
  mensagem: "como apago meus dados?",
  deve: [temIntencao("ajuda")],
  naoPode: [naoCaminho("fora")],
}
