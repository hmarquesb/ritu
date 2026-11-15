import type { CasoConversa } from "../tipos"
import { itensNaPergunta, perguntouCasa, tenhoATudo } from "./expectativas"

// Momento com frio; os melhores candidatos só têm itens incertos (confirmados há mais de 90 dias): o run pergunta a casa.
export const casoPergunta01: CasoConversa = {
  tipo: "conversa",
  id: "c2-p01-frio-so-incertos",
  titulo: "Frio, e os melhores candidatos só têm itens incertos",
  cenario: {
    nome: "c2-p01",
    descricao:
      "Frio; abóbora, arroz e gengibre incertos (120 dias): pergunta de casa, a pessoa tem a tudo",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [
      { alimento_id: "abobora", diasDesdeConfirmacao: 120 },
      { alimento_id: "arroz-branco", diasDesdeConfirmacao: 120 },
      { alimento_id: "gengibre", diasDesdeConfirmacao: 120 },
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
  respostas: [tenhoATudo],
  pergunta: "necessaria",
  deve: [perguntouCasa(), itensNaPergunta(5)],
  naoPode: [],
}
