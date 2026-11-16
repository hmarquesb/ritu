import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import {
  chamouResultadoRegistrar,
  fechouRetorno,
  naoFechou,
  reconheceRetorno,
} from "./expectativas"

const ARROZ = "Arroz bem cozido com abóbora e ghee"
const CHA = "Chá de gengibre com canela"

// A pessoa conta o retorno de ontem: resultado.registrar no pendente 1 (o mais recente), e o chá segue pendente.
export const casoAprendizado04: CasoConversa = {
  tipo: "conversa",
  id: "c2-a04-retorno-de-ontem-fechado",
  titulo: "Retorno de ontem contado na mensagem",
  familia: "aprendizado",
  cenario: {
    nome: "c2-a04",
    descricao: "Dois pendentes; o retorno de ontem é o pendente 1 e a pessoa diz que ajudou",
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
          titulo: ARROZ,
        },
        diasAtras: 1,
      },
      {
        sugestao: {
          tipo: "cha",
          pratica_id: "cha-gengibre-canela",
          alimentos: ["gengibre", "canela"],
          titulo: CHA,
        },
        diasAtras: 3,
      },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "aquilo de ontem me fez bem, e agora tô com frio", atalhos: [] },
    interpretacao: {
      intencoes: ["momento", "retorno"],
      estados: ["com_frio"],
      itens_casa: [],
      retorno: { resultado: "ajudou", pendente: 1 },
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  deve: [terminou(), chamouResultadoRegistrar(), fechouRetorno(ARROZ), reconheceRetorno()],
  naoPode: [naoFechou(CHA)],
}
