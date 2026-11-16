import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { naoDizQueAnotou } from "./expectativas"

// Mesma mensagem do caso 1: a resposta não diz que anotou nem fala do bloco; quem anota é a pessoa, no bloco.
export const casoPropostas06: CasoConversa = {
  tipo: "conversa",
  id: "c2-m06-almoco-fora-nao-diz-que-anotou",
  titulo: "Como o 1: a resposta não diz que anotou",
  cenario: {
    nome: "c2-m06",
    descricao:
      "Almoço fora todo dia, como o caso 1: a resposta não fala do bloco nem diz que anotou",
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
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "essa semana vou almoçar fora todo dia", atalhos: [] },
    interpretacao: {
      intencoes: ["vida"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      fato_de_rotina: "vou almoçar fora todo dia",
      suspeito: false,
    },
  },
  deve: [terminou()],
  naoPode: [naoDizQueAnotou()],
}
