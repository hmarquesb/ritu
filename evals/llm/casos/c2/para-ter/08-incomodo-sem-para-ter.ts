import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { semParaTer } from "./expectativas"

// Incômodo de saúde com cardamomo em falta três dias: o para_ter não sai num momento com incômodo.
export const casoParaTer08: CasoConversa = {
  tipo: "conversa",
  id: "c2-t08-incomodo-sem-para-ter",
  titulo: "Dor de cabeça com falta repetida: sem para_ter",
  familia: "para_ter",
  cenario: {
    nome: "c2-t08",
    descricao: "Dor de cabeça latejante com cardamomo em falta três dias: sem para_ter",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [
      { alimento_id: "abobora" },
      { alimento_id: "arroz-branco" },
      { alimento_id: "ghee" },
      { alimento_id: "gengibre" },
      { alimento_id: "canela" },
    ],
    faltas: [
      { alimento_id: "cardamomo", diasAtras: 1 },
      { alimento_id: "cardamomo", diasAtras: 2 },
      { alimento_id: "cardamomo", diasAtras: 3 },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "Tô com dor de cabeça latejante", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      incomodo: { id: "dor-de-cabeca", variante: "latejante" },
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  deve: [terminou(), semParaTer()],
  naoPode: [],
}
