import type { CasoInterprete } from "../tipos"
import { evitaGrupo, semMotivo, temIntencao } from "./expectativas"

export const caso10: CasoInterprete = {
  tipo: "interprete",
  id: "c2-10-alergia-camarao",
  titulo: "Alergia a camarão",
  mensagem: "sou alérgica a camarão",
  deve: [temIntencao("evitar"), evitaGrupo("frutos_do_mar")],
  naoPode: [semMotivo(["alergi"])],
}
