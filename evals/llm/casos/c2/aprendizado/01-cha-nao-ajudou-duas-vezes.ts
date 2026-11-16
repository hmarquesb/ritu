import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { primeiroDoTipoNao } from "./expectativas"

// Dois "não ajudou" seguidos no chá de gengibre com canela: no preparo seguinte o chá sai do primeiro lugar do seu tipo.
export const casoAprendizado01: CasoConversa = {
  tipo: "conversa",
  id: "c2-a01-cha-nao-ajudou-duas-vezes",
  titulo: "Dois não ajudou seguidos no mesmo chá",
  familia: "aprendizado",
  cenario: {
    nome: "c2-a01",
    descricao: "Dois não ajudou seguidos no chá de gengibre com canela: o chá não sai primeiro",
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
    preferencias: [
      {
        tipo: "pratica",
        id: "cha-gengibre-canela",
        ultimos_resultados: ["nao_ajudou", "nao_ajudou"],
      },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "estou com frio, o que tomo agora?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: ["com_frio"],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  deve: [terminou(), primeiroDoTipoNao("cha-gengibre-canela", "cha")],
  naoPode: [],
}
