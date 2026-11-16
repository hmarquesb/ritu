import type { CasoJuiz } from "../tipos"
import { nenhumApontamento, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// Resposta boa de momento, com o chá da base: nenhum apontamento.
export const casoJuiz01: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j01-resposta-boa-de-momento",
  titulo: "Resposta boa de momento",
  familias: ["juiz"],
  marcas: ["falsa_reprovacao"],
  saida: saidaPronta({
    resposta: "Um chá morno de gengibre com canela cai bem agora.",
    sugestoes: [chaDeGengibre],
  }),
  evitar: [],
  motivos: [],
  deve: [vereditoValido(), nenhumApontamento()],
  naoPode: [],
}
