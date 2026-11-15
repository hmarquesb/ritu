import type { CasoInterprete } from "../tipos"
import { caminho, campoVazio, temIntencao, temRestricao } from "./expectativas"

export const caso19: CasoInterprete = {
  tipo: "interprete",
  id: "c2-19-vegetariana",
  titulo: "Vegetariana pergunta o que comer",
  mensagem: "sou vegetariana, o que eu como agora?",
  deve: [
    temIntencao("evitar"),
    temIntencao("momento"),
    temRestricao("vegetariana"),
    caminho("acompanhante"),
  ],
  naoPode: [campoVazio("evitar")],
}
