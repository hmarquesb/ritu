import { terminou } from "../perguntas/expectativas"
import { naoDizQueAnotou } from "../propostas/expectativas"
import type { CasoConversa } from "../tipos"
import { apontaComoFicou, chamouResultadoRegistrar, nenhumRetornoFechado } from "./expectativas"

// Três pendentes e um "melhorei" sem pista: nenhum registro, e o texto pergunta como ficou.
export const casoAprendizado05: CasoConversa = {
  tipo: "conversa",
  id: "c2-a05-melhorei-sem-pista-como-ficou",
  titulo: "Melhorei, sem dizer de qual retorno",
  familias: ["aprendizado"],
  familia: "aprendizado",
  cenario: {
    nome: "c2-a05",
    descricao: "Três pendentes e um melhorei sem pista: nenhum retorno é fechado",
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
    retornos: [
      {
        sugestao: {
          tipo: "refeicao",
          preparo_id: "arroz-com-legume",
          alimentos: ["arroz-branco", "abobora"],
          titulo: "Arroz bem cozido com abóbora e ghee",
        },
        diasAtras: 1,
      },
      {
        sugestao: {
          tipo: "pratica",
          pratica_id: "pes-aquecidos",
          alimentos: [],
          titulo: "Pés aquecidos antes de dormir",
        },
        diasAtras: 2,
      },
      {
        sugestao: {
          tipo: "cha",
          pratica_id: "cha-gengibre-canela",
          alimentos: ["gengibre", "canela"],
          titulo: "Chá de gengibre com canela",
        },
        diasAtras: 3,
      },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "melhorei, e agora tô com frio", atalhos: [] },
    interpretacao: {
      intencoes: ["momento", "retorno"],
      estados: ["com_frio"],
      itens_casa: [],
      retorno: { resultado: "ajudou" },
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  deve: [terminou(), nenhumRetornoFechado(), apontaComoFicou(), naoDizQueAnotou()],
  naoPode: [chamouResultadoRegistrar()],
}
