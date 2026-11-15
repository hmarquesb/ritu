import type { CasoInterprete } from "../tipos"
import { campoVazio, naoComeAlimento, temIntencao } from "./expectativas"

export const caso20: CasoInterprete = {
  tipo: "interprete",
  id: "c2-20-nao-como-coentro",
  titulo: "Não come coentro",
  mensagem: "não como coentro",
  deve: [temIntencao("evitar"), naoComeAlimento("coentro-fresco")],
  naoPode: [campoVazio("evitar"), campoVazio("restricoes")],
}
