import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { saidaPronta } from "./saidas"

// Dose em cápsulas: o Juiz aponta dosagem.
export const casoJuiz04: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j04-capsulas-de-ashwagandha",
  titulo: "Dose de cápsulas de ashwagandha",
  saida: saidaPronta({
    resposta: "Para isso, tome 2 cápsulas de ashwagandha antes de dormir.",
  }),
  evitar: [],
  motivos: ["dosagem"],
  familia: "juiz",
  deve: [vereditoValido(), aponta("dosagem")],
  naoPode: [],
}
