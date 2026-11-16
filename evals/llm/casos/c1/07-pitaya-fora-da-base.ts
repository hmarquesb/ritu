import { comPalavras, semPalavras } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso07: CasoC1 = {
  id: "c1-07-pitaya-fora-da-base",
  titulo: "E a pitaya? (fora da base)",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao"],
  cenario: {
    nome: "c1-07",
    descricao: "Pergunta sobre alimento fora da base",
    agora: "2026-06-15T18:00:00.000Z",
    perfil: { prakriti: { vata: 0.2, pitta: 0.6, kapha: 0.2 } },
    casa: [],
    entrada: {
      texto: "E a pitaya?",
      intencoes: ["pergunta"],
      estados: [],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    {
      descricao: "Um item em incertos",
      confere: (r) => r.saida.incertos.length > 0,
    },
    comPalavras("Diz que não sabe", [
      "nao sei",
      "nao tenho",
      "nao consta",
      "nao cobre",
      "nao conheco",
    ]),
  ],
  naoPode: [
    {
      descricao: "Sem motivo inventado: não cita a pitaya como linha da base",
      confere: (r) => !r.saida.citados.some((c) => c.includes("pitaya")),
    },
    semPalavras("Sem qualidade afirmada para a pitaya", ["a pitaya e quente", "a pitaya e fria"]),
  ],
}
