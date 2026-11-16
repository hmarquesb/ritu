import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { chaDeGengibre, saidaPronta } from "./saidas"

// O motivo diz que refresca, e a linha da base do gengibre diz que aquece.
export const casoJuiz07: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j07-refresca-com-linha-que-aquece",
  titulo: "Motivo que refresca, com a base dizendo que aquece",
  familias: ["juiz"],
  saida: saidaPronta({
    resposta: "Um chá de gengibre com canela para este momento.",
    sugestoes: [{ ...chaDeGengibre, motivo: "Refresca e acalma." }],
  }),
  evitar: [],
  motivos: ["motivo_sem_base"],
  deve: [vereditoValido(), aponta("motivo_sem_base")],
  naoPode: [],
}
