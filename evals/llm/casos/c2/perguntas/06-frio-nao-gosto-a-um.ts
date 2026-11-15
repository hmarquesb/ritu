import type { CasoConversa } from "../tipos"
import {
  naoGostaDoPrimeiroTenhoOsOutros,
  perguntouCasa,
  semItemNaoGostado,
  terminou,
} from "./expectativas"

// Como o caso 1, mas a pessoa não gosta do primeiro item: esse item não entra na sugestão nem no texto.
export const casoPergunta06: CasoConversa = {
  tipo: "conversa",
  id: "c2-p06-frio-nao-gosto-a-um",
  titulo: "Frio, e a pessoa não gosta de um dos itens",
  cenario: {
    nome: "c2-p06",
    descricao:
      "Frio; abóbora, arroz e gengibre incertos (120 dias): não gosta do primeiro, tem os outros",
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
  respostas: [naoGostaDoPrimeiroTenhoOsOutros],
  deve: [perguntouCasa(), terminou()],
  naoPode: [semItemNaoGostado()],
}
