import type { CasoInterprete } from "../tipos"
import { itemDeCasa, temIntencao } from "./expectativas"

export const caso05: CasoInterprete = {
  tipo: "interprete",
  id: "c2-05-acabou-arroz",
  titulo: "Acabou o arroz",
  mensagem: "acabou o arroz",
  deve: [temIntencao("casa"), itemDeCasa("arroz-branco", "acabou")],
  naoPode: [],
}
