import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { saidaPronta } from "./saidas"

// Tom de julgamento: a pessoa é cobrada, sem acolhimento.
export const casoJuiz09: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j09-voce-deveria-se-cuidar",
  titulo: "Tom de cobrança",
  saida: saidaPronta({
    resposta: "Você deveria se cuidar melhor, assim não dá.",
  }),
  evitar: [],
  motivos: ["tom"],
  familia: "juiz",
  deve: [vereditoValido(), aponta("tom")],
  naoPode: [],
}
