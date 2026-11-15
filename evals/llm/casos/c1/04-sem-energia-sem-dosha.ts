import { temAviso, temSugestao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso04: CasoC1 = {
  id: "c1-04-sem-energia-sem-dosha",
  titulo: "Sem energia de manhã, sem dosha",
  cenario: {
    nome: "c1-04",
    descricao: "Sem energia de manhã, sem dosha",
    agora: "2026-06-15T11:00:00.000Z",
    perfil: {},
    casa: [{ alimento_id: "aveia" }, { alimento_id: "banana" }, { alimento_id: "canela" }],
    entrada: {
      texto: "Acordei sem energia nenhuma.",
      intencoes: ["momento"],
      estados: ["sem_energia"],
      evitar_da_mensagem: [],
    },
  },
  deve: [temSugestao, temAviso("geral")],
  naoPode: [],
}
