import type { CasoJuiz } from "../tipos"
import { aponta, aprovado, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// Jargão sem explicação: registro que só avisa, sem reprovar.
export const casoJuiz10: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j10-isso-acalma-vata",
  titulo: "Jargão sem explicar: isso acalma Vata",
  saida: saidaPronta({
    resposta: "Isso acalma Vata.",
    sugestoes: [chaDeGengibre],
  }),
  evitar: [],
  motivos: ["jargao"],
  boa: true,
  familia: "juiz",
  deve: [vereditoValido(), aponta("jargao"), aprovado()],
  naoPode: [],
}
