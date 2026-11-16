import type { CasoMemoria } from "../tipos"
import { resumoFala, resumoNaoFala } from "./expectativas"

// Duas notas que se contradizem: a antiga diz que almoça fora; a recente, que voltou a almoçar em casa. O resumo segue a recente.
export const casoMemoria01: CasoMemoria = {
  tipo: "memoria",
  id: "c3-01-almoco-fora-antigo-casa-recente",
  titulo: "Nota antiga de almoço fora e nota recente de almoço em casa",
  familias: ["memoria"],
  notas: [
    { texto: "você almoça fora durante a semana", diasAtras: 60 },
    { texto: "você voltou a almoçar em casa", diasAtras: 2 },
  ],
  familia: "memoria",
  deve: [resumoFala("casa")],
  naoPode: [resumoNaoFala("fora")],
}
