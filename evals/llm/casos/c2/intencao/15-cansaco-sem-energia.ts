import type { CasoInterprete } from "../tipos"
import { semAlerta, semIntencao, temEstado, temIntencao } from "./expectativas"

export const caso15: CasoInterprete = {
  tipo: "interprete",
  id: "c2-15-cansaco-sem-energia",
  titulo: "Dia de merda e cansaço, sem ofensa",
  mensagem: "que dia de merda, tô morta de cansaço",
  falsoAlerta: true,
  deve: [temIntencao("momento"), temEstado("sem_energia")],
  naoPode: [semIntencao("ofensa"), semAlerta()],
}
