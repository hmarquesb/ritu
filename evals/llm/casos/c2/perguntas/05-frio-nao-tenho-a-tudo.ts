import type { CasoConversa } from "../tipos"
import {
  naoTenhoATudo,
  perguntouCasa,
  semItemNaSaida,
  semSegundaPerguntaSobre,
  terminou,
} from "./expectativas"

// Como o caso 1, mas a pessoa não tem nenhum dos itens: a entrega sai sem eles e o run não pergunta de novo sobre os mesmos.
export const casoPergunta05: CasoConversa = {
  tipo: "conversa",
  id: "c2-p05-frio-nao-tenho-a-tudo",
  titulo: "Frio, e a pessoa não tem os itens incertos",
  cenario: {
    nome: "c2-p05",
    descricao:
      "Frio; abóbora, arroz e gengibre incertos (120 dias): pergunta de casa, a pessoa não tem nenhum",
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
  respostas: [naoTenhoATudo],
  deve: [perguntouCasa(), terminou()],
  naoPode: [
    semSegundaPerguntaSobre(["abobora", "arroz-branco", "gengibre"]),
    semItemNaSaida("abobora"),
    semItemNaSaida("arroz-branco"),
    semItemNaSaida("gengibre"),
  ],
}
