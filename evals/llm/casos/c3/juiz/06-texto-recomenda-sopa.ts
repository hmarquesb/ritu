import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// O texto recomenda sopa, mas as sugestões só têm chá.
export const casoJuiz06: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j06-texto-recomenda-sopa",
  titulo: "Texto recomenda sopa e as sugestões só têm chá",
  familias: ["juiz"],
  saida: saidaPronta({
    resposta: "Uma sopa quente de gengibre cai bem agora.",
    sugestoes: [chaDeGengibre],
  }),
  evitar: [],
  motivos: ["texto_diferente"],
  familia: "juiz",
  deve: [vereditoValido(), aponta("texto_diferente")],
  naoPode: [],
}
