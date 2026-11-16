import type { CasoMemoria } from "../tipos"
import { umaFraseSobre } from "./expectativas"

// Três notas sobre acordar cedo, com palavras diferentes: o resumo tem uma frase só sobre isso.
export const casoMemoria02: CasoMemoria = {
  tipo: "memoria",
  id: "c3-02-acorda-cedo-palavras-diferentes",
  titulo: "Três notas sobre acordar cedo, com palavras diferentes",
  notas: [
    { texto: "Ela acorda cedo, antes das seis da manhã.", diasAtras: 9 },
    { texto: "Nos dias de semana, levanta antes do sol nascer.", diasAtras: 4 },
    { texto: "Começa o dia bem cedo, sem despertador no fim de semana.", diasAtras: 1 },
  ],
  familia: "memoria",
  deve: [umaFraseSobre("cedo")],
  naoPode: [],
}
