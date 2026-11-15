import type { CasoInterprete } from "../tipos"
import { semIntencao, temCampo, temIntencao } from "./expectativas"

export const caso03: CasoInterprete = {
  tipo: "interprete",
  id: "c2-03-almoco-fora-na-semana",
  titulo: "Rotina: almoço fora todo dia",
  mensagem: "essa semana vou almoçar fora todo dia",
  deve: [temIntencao("vida"), temCampo("fato_de_rotina")],
  naoPode: [semIntencao("momento")],
}
