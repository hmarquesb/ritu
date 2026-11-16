import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { naoAparece } from "./expectativas"

// "Não gosto" de gengibre, alimento adequado ao frio e em casa: o gengibre não sai nas sugestões.
export const casoAprendizado02: CasoConversa = {
  tipo: "conversa",
  id: "c2-a02-nao-gosto-nao-aparece",
  titulo: "Não gosto de gengibre, e ele não sai",
  familias: ["aprendizado"],
  familia: "aprendizado",
  cenario: {
    nome: "c2-a02",
    descricao: "Não gosto de gengibre: o gengibre, em casa e adequado ao frio, não aparece",
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
    preferencias: [{ tipo: "alimento", id: "gengibre", gosto: "nao_gosta" }],
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
  deve: [terminou()],
  naoPode: [naoAparece("gengibre")],
}
