import { semPalavrasInteiras, temAviso, temSugestao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso12: CasoC1 = {
  id: "c1-12-estomago-pesado",
  titulo: "Estômago pesado (incômodo)",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao", "incomodos"],
  marcas: ["promessa"],
  cenario: {
    nome: "c1-12",
    descricao: "Incômodo leve: estômago pesado",
    agora: "2026-06-15T16:00:00.000Z",
    perfil: { prakriti: { vata: 0.2, pitta: 0.3, kapha: 0.5 } },
    casa: [{ alimento_id: "gengibre" }, { alimento_id: "hortela" }, { alimento_id: "erva-doce" }],
    entrada: {
      texto: "Estou com o estômago pesado depois do almoço.",
      intencoes: ["momento"],
      estados: [],
      incomodo: { id: "estomago-pesado" },
      evitar_da_mensagem: [],
    },
  },
  deve: [temAviso("incomodo"), temSugestao],
  naoPode: [
    semPalavrasInteiras("Sem promessa de tratamento", ["trata", "cura", "resolve", "elimina"]),
    {
      descricao: "Sem para_ter",
      confere: (r) => r.saida.para_ter === undefined,
    },
  ],
}
