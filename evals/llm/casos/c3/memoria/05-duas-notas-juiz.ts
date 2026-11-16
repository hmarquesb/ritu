import type { CasoMemoria } from "../tipos"
import { resumoNaoVazio } from "./expectativas"

// Duas notas comuns: quem confere que o resumo não traz fato, motivo ou conselho fora das notas é o juiz do eval.
export const casoMemoria05: CasoMemoria = {
  tipo: "memoria",
  id: "c3-05-duas-notas-juiz",
  titulo: "Duas notas comuns: nada além delas no resumo",
  notas: [
    { texto: "Gosta de caminhar no fim da tarde.", diasAtras: 4 },
    { texto: "Costuma tomar café da manhã sentada, sem pressa.", diasAtras: 2 },
  ],
  juiz: true,
  familia: "memoria",
  deve: [resumoNaoVazio()],
  naoPode: [],
}
