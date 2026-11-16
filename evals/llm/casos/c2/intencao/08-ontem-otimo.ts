import type { CasoInterprete } from "../tipos"
import { retorno, semPendente, temIntencao } from "./expectativas"

export const caso08: CasoInterprete = {
  tipo: "interprete",
  id: "c2-08-ontem-otimo",
  titulo: "Aquilo de ontem foi ótimo",
  familias: ["intencao"],
  mensagem: "aquilo de ontem foi ótimo",
  pendentes: [
    { tipo: "cha", titulo: "Chá de gengibre com canela" },
    { tipo: "refeicao", titulo: "Arroz bem cozido com abóbora e ghee" },
  ],
  deve: [temIntencao("retorno"), retorno("ajudou")],
  naoPode: [semPendente()],
}
