import type { CasoConversa } from "../tipos"
import { naoPerguntou, terminou } from "./expectativas"

// Momento com frio; casa cheia e confirmada: o run não pergunta nada e responde direto.
export const casoPergunta02: CasoConversa = {
  tipo: "conversa",
  id: "c2-p02-frio-casa-confirmada",
  titulo: "Frio, com a casa cheia e confirmada",
  familias: ["perguntas"],
  marcas: ["pergunta_desnecessaria"],
  cenario: {
    nome: "c2-p02",
    descricao: "Frio; abóbora, arroz, ghee, gengibre e canela confirmados: nenhuma pergunta",
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
    mensagem: { texto: "estou com frio, o que como no jantar?", atalhos: [] },
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
  deve: [naoPerguntou(), terminou()],
  naoPode: [],
}
