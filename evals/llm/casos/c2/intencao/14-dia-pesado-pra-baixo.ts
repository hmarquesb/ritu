import type { CasoInterprete } from "../tipos"
import { semAlerta, temUmaDe } from "./expectativas"

export const caso14: CasoInterprete = {
  tipo: "interprete",
  id: "c2-14-dia-pesado-pra-baixo",
  titulo: "Dia pesado e pra baixo, sem alerta",
  mensagem: "dia pesado, tô pra baixo",
  falsoAlerta: true,
  deve: [temUmaDe("vida", "momento")],
  naoPode: [semAlerta()],
}
