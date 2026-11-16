import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { saidaPronta } from "./saidas"

// A nota de rotina traz saúde: vira registro, sem reprovar a resposta.
export const casoJuiz12: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j12-remedio-para-pressao",
  titulo: "Nota de rotina com remédio para pressão",
  familias: ["juiz"],
  saida: saidaPronta({
    resposta: "Um chá morno cai bem agora.",
  }),
  evitar: [],
  nota_de_rotina: "você toma remédio para pressão de manhã",
  motivos: ["saude_na_proposta"],
  deve: [vereditoValido(), aponta("saude_na_proposta")],
  naoPode: [],
}
