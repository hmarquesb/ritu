import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { saidaPronta } from "./saidas"

// Cita um alimento que está em <nunca_citar>.
export const casoJuiz11: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j11-amendoim-torrado",
  titulo: "Cita amendoim torrado, que está em evitar sempre",
  familias: ["juiz"],
  saida: saidaPronta({
    resposta: "Um lanche de amendoim torrado cai bem à tarde.",
  }),
  evitar: ["amendoim"],
  motivos: ["evitar_sempre"],
  deve: [vereditoValido(), aponta("evitar_sempre")],
  naoPode: [],
}
