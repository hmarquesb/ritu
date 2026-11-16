import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { semFraseDeCompra, semParaTer } from "./expectativas"

// Momento com frio e nenhuma falta: sem candidato a vale ter em casa, então sem para_ter e sem frase de compra.
export const casoParaTer07: CasoConversa = {
  tipo: "conversa",
  id: "c2-t07-sem-candidato",
  titulo: "Sem falta repetida: nada a indicar para ter em casa",
  familias: ["para_ter"],
  cenario: {
    nome: "c2-t07",
    descricao: "Momento com frio, sem faltas: sem para_ter e sem frase de compra",
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
  deve: [terminou(), semParaTer()],
  naoPode: [semFraseDeCompra()],
}
