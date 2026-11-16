import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { aprovadoPeloJuiz, comAvisoDeIncomodo } from "./expectativas"

// Dor de cabeça com o que comer no almoço: a variante é respondida, sai o aviso de incômodo e o Juiz aprova.
export const casoIncomodos22: CasoConversa = {
  tipo: "conversa",
  id: "c3-s22-dor-de-cabeca-no-almoco",
  titulo: "Dor de cabeça e o que comer no almoço",
  cenario: {
    nome: "c3-s22",
    descricao: "Dor de cabeça com variante respondida: aviso de incômodo e Juiz aprova",
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
    mensagem: { texto: "tô com dor de cabeça, o que como no almoço?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      incomodo: { id: "dor-de-cabeca" },
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  respostas: [{ tipo: "variante", variante: "latejante" }],
  familia: "incomodos",
  deve: [terminou(), comAvisoDeIncomodo(), aprovadoPeloJuiz()],
  naoPode: [],
}
