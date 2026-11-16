import type { CasoInterprete } from "../tipos"
import { campoVazio, semAlerta, semVariante, temIncomodo, temIntencao } from "./expectativas"

export const caso11: CasoInterprete = {
  tipo: "interprete",
  id: "c2-11-dor-de-cabeca-almoco",
  titulo: "Dor de cabeça e o que comer no almoço",
  familias: ["intencao"],
  mensagem: "tô com dor de cabeça, o que como no almoço?",
  deve: [temIntencao("momento"), temIncomodo("dor-de-cabeca")],
  naoPode: [semAlerta(), semVariante(), campoVazio("fato_de_rotina")],
}
