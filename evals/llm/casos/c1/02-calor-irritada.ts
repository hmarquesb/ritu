import { semPalavras, temSugestao, trazGuna } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso02: CasoC1 = {
  id: "c1-02-calor-irritada",
  titulo: "Calor e irritada, Pitta",
  cenario: {
    nome: "c1-02",
    descricao: "Calor e irritada, Pitta",
    agora: "2026-01-20T17:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.15, pitta: 0.7, kapha: 0.15 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [{ alimento_id: "pepino" }, { alimento_id: "hortela" }, { alimento_id: "coco" }],
    clima: { temperatura_aparente: 35, umidade: 60 },
    entrada: {
      texto: "Está um calor enorme e estou irritada.",
      intencoes: ["momento"],
      estados: ["com_calor", "irritada"],
      evitar_da_mensagem: [],
    },
  },
  deve: [temSugestao, trazGuna("Algo que refresca", ["frio"])],
  naoPode: [
    semPalavras("Sem picante nem fermentado", [
      "picante",
      "pimenta",
      "fermentado",
      "fermentada",
      "vinagre",
    ]),
  ],
  trajetoria: { chamadas: ["clima.agora"] },
}
