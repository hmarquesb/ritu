import type { CasoInterprete } from "../tipos"
import { campoVazio, semAlerta, temEstado, temIntencao } from "./expectativas"

export const caso01: CasoInterprete = {
  tipo: "interprete",
  id: "c2-01-frio-sem-fome",
  titulo: "Acordou com frio e sem fome",
  mensagem: "acordei com frio e sem fome",
  deve: [temIntencao("momento"), temEstado("com_frio")],
  naoPode: [semAlerta(), campoVazio("incomodo")],
}
