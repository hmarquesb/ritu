import type { CasoConversa } from "../tipos"
import { naoPerguntou, nuncaPerguntou, semItemNaSaida, terminou } from "./expectativas"

// Gengibre é de "evitar sempre" e serviria a um chá bom para o frio: o item nunca é perguntado nem sugerido.
export const casoPergunta07: CasoConversa = {
  tipo: "conversa",
  id: "c2-p07-frio-evitar-sempre",
  titulo: "Frio, e o item de evitar sempre serviria",
  cenario: {
    nome: "c2-p07",
    descricao:
      "Frio; gengibre incerto (120 dias) e de evitar sempre; abóbora, arroz e ghee confirmados: nenhuma pergunta sobre o gengibre",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
      evitar_sempre: [{ tipo: "alimento", valor: "gengibre" }],
    },
    casa: [
      { alimento_id: "gengibre", diasDesdeConfirmacao: 120 },
      { alimento_id: "abobora" },
      { alimento_id: "arroz-branco" },
      { alimento_id: "ghee" },
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
  pergunta: "desnecessaria",
  deve: [naoPerguntou(), terminou()],
  naoPode: [nuncaPerguntou("gengibre"), semItemNaSaida("gengibre")],
}
