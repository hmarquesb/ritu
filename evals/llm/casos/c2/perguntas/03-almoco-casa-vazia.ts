import type { CasoConversa } from "../tipos"
import { itensNaPergunta, perguntouCasa, tenhoATudo } from "./expectativas"

// Momento com Minha casa vazia: a refeição depende de perguntas; o run pergunta até 5 itens.
export const casoPergunta03: CasoConversa = {
  tipo: "conversa",
  id: "c2-p03-almoco-casa-vazia",
  titulo: "Momento com Minha casa vazia",
  familias: ["perguntas", "casa"],
  marcas: ["pergunta_necessaria"],
  cenario: {
    nome: "c2-p03",
    descricao: "Frio, casa vazia: pergunta de casa com até 5 itens, a pessoa tem a tudo",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "estou com frio, o que como no almoço?", atalhos: [] },
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
  respostas: [tenhoATudo],
  deve: [perguntouCasa(), itensNaPergunta(5)],
  naoPode: [],
}
