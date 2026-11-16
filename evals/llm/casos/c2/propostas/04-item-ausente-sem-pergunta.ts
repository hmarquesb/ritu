import { terminou } from "../perguntas/expectativas"
import type { CasoConversa } from "../tipos"
import { nenhumaListaAceita } from "./expectativas"

// Gengibre fora da casa, mas sem resposta da pessoa à pergunta: a lista.propor não é aceita.
export const casoPropostas04: CasoConversa = {
  tipo: "conversa",
  id: "c2-m04-item-ausente-sem-pergunta",
  titulo: "Momento sem resposta à pergunta, com item ausente entre os candidatos",
  familias: ["propostas"],
  cenario: {
    nome: "c2-m04",
    descricao: "Frio, gengibre fora da casa, sem resposta à pergunta: nenhuma lista.propor aceita",
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
  deve: [terminou(), nenhumaListaAceita()],
  naoPode: [],
}
