import { citou } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso06: CasoC1 = {
  id: "c1-06-pergunta-gengibre",
  titulo: "Por que gengibre aquece?",
  cenario: {
    nome: "c1-06",
    descricao: "Pergunta sobre gengibre",
    agora: "2026-06-15T18:00:00.000Z",
    perfil: { prakriti: { vata: 0.5, pitta: 0.2, kapha: 0.3 } },
    casa: [],
    entrada: {
      texto: "Por que gengibre aquece?",
      intencoes: ["pergunta"],
      estados: [],
      evitar_da_mensagem: [],
    },
  },
  deve: [citou("alimentos:gengibre")],
  naoPode: [],
  trajetoria: { maxChamadasDeModelo: 2 },
}
