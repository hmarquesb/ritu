import type { CasoConversa } from "../tipos"
import { naoPerguntou, terminou } from "./expectativas"

// Pergunta sobre um alimento: responde a pergunta, sem perguntar a casa.
export const casoPergunta04: CasoConversa = {
  tipo: "conversa",
  id: "c2-p04-manga-pergunta-pitta",
  titulo: "Pergunta sobre manga para Pitta",
  cenario: {
    nome: "c2-p04",
    descricao: "Pergunta sobre manga e Pitta, com Minha casa vazia: nenhuma pergunta",
    agora: "2026-06-15T18:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.2, pitta: 0.6, kapha: 0.2 },
    },
    casa: [],
    mensagem: { texto: "Manga é boa para Pitta?", atalhos: [] },
    interpretacao: {
      intencoes: ["pergunta"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  pergunta: "desnecessaria",
  deve: [naoPerguntou(), terminou()],
  naoPode: [],
}
