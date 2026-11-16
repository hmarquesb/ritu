import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { semRefeicao } from "./expectativas"

// Na hora do almoço, com o resumo "Você almoça fora durante a semana.": nada que pede cozinhar em casa naquele almoço.
export const casoMemoria06: CasoConversa = {
  tipo: "conversa",
  id: "c3-06-almoco-fora-sem-cozinhar",
  titulo: "Hora do almoço, com a rotina de almoçar fora na semana",
  familias: ["memoria"],
  cenario: {
    nome: "c3-06",
    descricao: "Almoço, com a nota de rotina de almoço fora; sem refeição para cozinhar em casa",
    agora: "2026-06-15T15:30:00.000Z",
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
    rotina: [{ texto: "você almoça fora durante a semana", diasAtras: 3 }],
    mensagem: { texto: "estou com fome, o que eu almoço hoje?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  familia: "memoria",
  deve: [terminou()],
  naoPode: [semRefeicao()],
}
