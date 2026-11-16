import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { nenhumaProposta } from "./expectativas"

// Desabafo sem fato de rotina: nada a anotar, então o bloco não traz proposta.
export const casoPropostas02: CasoConversa = {
  tipo: "conversa",
  id: "c2-m02-dia-corrido-nenhuma",
  titulo: "Dia corrido, sem fato de rotina",
  familias: ["propostas"],
  cenario: {
    nome: "c2-m02",
    descricao: "Hoje o dia foi corrido, sem fato de rotina: nenhuma proposta",
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
    mensagem: { texto: "hoje o dia foi corrido", atalhos: [] },
    interpretacao: {
      intencoes: ["vida"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  proposta: "nenhuma",
  deve: [terminou()],
  naoPode: [nenhumaProposta()],
}
