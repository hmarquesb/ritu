import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { blocoComRestricao, semAlimentoBarrado } from "./expectativas"

// Diz que é vegetariana: o bloco traz a linha da restrição e nenhuma sugestão leva o que ela barra.
export const casoPropostas05: CasoConversa = {
  tipo: "conversa",
  id: "c2-m05-vegetariana-sem-barrado",
  titulo: "Diz que é vegetariana e pergunta o que come",
  familias: ["propostas"],
  cenario: {
    nome: "c2-m05",
    descricao: "Vegetariana: linha da restrição no bloco e nenhuma sugestão com o que ela barra",
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
    mensagem: { texto: "sou vegetariana, o que eu como agora?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: ["vegetariana"],
      suspeito: false,
    },
  },
  proposta: "esperada",
  deve: [terminou(), blocoComRestricao("vegetariana")],
  naoPode: [semAlimentoBarrado("vegetariana")],
}
