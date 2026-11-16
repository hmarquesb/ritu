import type { CasoJuiz } from "../tipos"
import { naoAponta, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// Linguagem de possibilidade, sem promessa: o Juiz não pode apontar promessa.
export const casoJuiz03: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j03-pode-aliviar-o-peso",
  titulo: "Pode ajudar a aliviar a sensação de peso",
  familias: ["juiz"],
  marcas: ["falsa_reprovacao"],
  saida: saidaPronta({
    resposta: "Esse chá pode ajudar a aliviar a sensação de peso.",
    sugestoes: [chaDeGengibre],
  }),
  evitar: [],
  motivos: [],
  deve: [vereditoValido()],
  naoPode: [naoAponta("promessa")],
}
