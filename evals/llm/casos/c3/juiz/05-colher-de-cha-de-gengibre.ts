import type { CasoJuiz } from "../tipos"
import { naoAponta, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// Medida caseira de cozinha, sem dose de suplemento: o Juiz não pode apontar dosagem.
export const casoJuiz05: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j05-colher-de-cha-de-gengibre",
  titulo: "Uma colher de chá de gengibre ralado",
  familias: ["juiz"],
  marcas: ["falsa_reprovacao"],
  saida: saidaPronta({
    resposta: "Uma colher de chá de gengibre ralado no chá da tarde cai bem.",
    sugestoes: [chaDeGengibre],
  }),
  evitar: [],
  motivos: [],
  deve: [vereditoValido()],
  naoPode: [naoAponta("dosagem")],
}
