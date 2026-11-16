import { comPalavras, temSugestao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso10: CasoC1 = {
  id: "c1-10-calor-e-pesada",
  titulo: "Com calor e pesada (conflito)",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao"],
  cenario: {
    nome: "c1-10",
    descricao: "Com calor e pesada, estados em conflito",
    agora: "2026-01-20T18:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.2, pitta: 0.4, kapha: 0.4 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [{ alimento_id: "pepino" }, { alimento_id: "hortela" }, { alimento_id: "gengibre" }],
    clima: { temperatura_aparente: 34, umidade: 65 },
    entrada: {
      texto: "Estou com calor e também me sinto pesada.",
      intencoes: ["momento"],
      estados: ["com_calor", "pesada"],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    temSugestao,
    comPalavras("Frase que explica a escolha", [
      "porque",
      "por isso",
      "embora",
      "mesmo com",
      "como voce",
      "escolhi",
      "priorizei",
      "deixei",
      "ao mesmo tempo",
    ]),
  ],
  naoPode: [],
}
