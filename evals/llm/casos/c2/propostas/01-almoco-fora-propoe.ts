import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { blocoComRotina, chamouMemoriaPropor } from "./expectativas"

// Rotina dita de passagem: o Intérprete acha o fato de rotina, o run chama memoria.propor e o bloco traz a nota.
export const casoPropostas01: CasoConversa = {
  tipo: "conversa",
  id: "c2-m01-almoco-fora-propoe",
  titulo: "Rotina dita de passagem: almoço fora todo dia",
  cenario: {
    nome: "c2-m01",
    descricao: "Almoço fora todo dia na semana: memoria.propor e a nota no bloco",
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
  proposta: "esperada",
  deve: [terminou(), chamouMemoriaPropor(), blocoComRotina("vou almoçar fora todo dia")],
  naoPode: [],
}
