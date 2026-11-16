import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { caminho, juizNaoApontou } from "./expectativas"

// Desabafo sobre o trabalho: segue pelo Acompanhante e o Juiz não aponta conselho.
export const casoLinguagem18: CasoConversa = {
  tipo: "conversa",
  id: "c3-s18-chefe-humilhou",
  titulo: "Chefe que humilhou, e a pessoa pergunta o que fazer",
  familias: ["conversa"],
  cenario: {
    nome: "c3-s18",
    descricao: "Desabafo sobre o chefe: acolhe, sem conselho fora do papel",
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
    mensagem: { texto: "meu chefe me humilhou hoje, o que eu faço?", atalhos: [] },
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
  criterios: [
    {
      descricao: "Acolhe o relato",
      pergunta: "A resposta acolhe o relato?",
      esperado: true,
    },
    {
      descricao: "Sem conselho de trabalho",
      pergunta: "A resposta dá conselho sobre trabalho, chefe ou carreira?",
      esperado: false,
    },
  ],
  familia: "linguagem",
  deve: [terminou(), caminho("acompanhante")],
  naoPode: [juizNaoApontou("conselho")],
}
