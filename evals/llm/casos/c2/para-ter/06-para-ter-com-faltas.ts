import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { comParaTer, falaDasProximasVezes, semFraseDeCompra } from "./expectativas"

// Cardamomo em falta há três dias, momento sem incômodo: o para_ter sai e a frase fala das próximas vezes.
export const casoParaTer06: CasoConversa = {
  tipo: "conversa",
  id: "c2-t06-para-ter-com-faltas",
  titulo: "Cardamomo em falta três dias: vale ter em casa",
  familia: "para_ter",
  cenario: {
    nome: "c2-t06",
    descricao:
      "Cardamomo em falta em três dias, momento com frio: o para_ter fala das próximas vezes",
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
    faltas: [
      { alimento_id: "cardamomo", diasAtras: 1 },
      { alimento_id: "cardamomo", diasAtras: 2 },
      { alimento_id: "cardamomo", diasAtras: 3 },
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
  deve: [terminou(), comParaTer(), falaDasProximasVezes()],
  naoPode: [semFraseDeCompra()],
}
