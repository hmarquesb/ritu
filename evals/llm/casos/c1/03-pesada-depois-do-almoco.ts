import {
  semAdocantes,
  semAlimentos,
  semPalavrasInteiras,
  temSugestao,
  trazGuna,
} from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso03: CasoC1 = {
  id: "c1-03-pesada-depois-do-almoco",
  titulo: "Pesada, depois do almoço, Kapha",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao"],
  cenario: {
    nome: "c1-03",
    descricao: "Pesada, depois do almoço, Kapha",
    agora: "2026-06-15T16:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.1, pitta: 0.2, kapha: 0.7 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [{ alimento_id: "gengibre" }, { alimento_id: "hortela" }, { alimento_id: "mel" }],
    clima: { temperatura_aparente: 24, umidade: 70 },
    entrada: {
      texto: "Estou me sentindo pesada depois do almoço.",
      intencoes: ["momento"],
      estados: ["pesada"],
      evitar_da_mensagem: [],
    },
  },
  deve: [temSugestao, trazGuna("Algo leve ou que alivia o peso", ["leve", "quente", "seco"])],
  naoPode: [
    semAlimentos("Sem laticínio", [
      "leite",
      "iogurte-natural",
      "queijo-minas",
      "ricota",
      "manteiga",
    ]),
    semPalavrasInteiras("Sem laticínio nem doce no texto", [
      "laticinio",
      "laticinios",
      "queijo",
      "queijos",
      "doce de",
      "sobremesa",
      "sobremesas",
    ]),
    semAdocantes("Sem adoçante (mel, açúcar, rapadura) entre os itens"),
  ],
  trajetoria: { proibidas: ["historico.recente"] },
}
