import { naoTenhoATudo, terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { listaNoMaximoUma, listaSoDe } from "./expectativas"

// O run pergunta sobre o gengibre, que não está em casa, e a pessoa diz que não tem: no máximo uma lista.propor, e só dele.
export const casoPropostas03: CasoConversa = {
  tipo: "conversa",
  id: "c2-m03-nao-tenho-um-item",
  titulo: "Momento, e a pessoa não tem o item que faltou",
  familias: ["propostas"],
  cenario: {
    nome: "c2-m03",
    descricao:
      "Frio, gengibre fora da casa: pergunta de casa, Não tenho, no máximo uma lista.propor do gengibre",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [
      { alimento_id: "abobora" },
      { alimento_id: "arroz-branco" },
      { alimento_id: "ghee" },
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
  respostas: [naoTenhoATudo],
  deve: [terminou(), listaNoMaximoUma(), listaSoDe("gengibre")],
  naoPode: [],
}
