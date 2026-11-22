import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { sugere } from "../memoria/expectativas"

// Com frio à noite, e o alecrim é a única erva da casa: o chá de alecrim sai, e o caso confere o texto pelo critério incerto.
export const casoMemoria24: CasoConversa = {
  tipo: "conversa",
  id: "c3-s24-cha-da-casa",
  titulo: "Chá com a única erva que tem em casa",
  familias: ["memoria"],
  cenario: {
    nome: "c3-s24",
    descricao:
      "Com frio à noite (21h30); alecrim é a única erva de casa, com arroz, abóbora e ghee",
    agora: "2026-06-16T00:30:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [
      { alimento_id: "abobora" },
      { alimento_id: "arroz-branco" },
      { alimento_id: "ghee" },
      { alimento_id: "alecrim" },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "tô com frio e já é noite", atalhos: [] },
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
  criterios: [
    {
      descricao: "Cita o alecrim pelo nome",
      pergunta: "O texto cita o alecrim pelo nome?",
      esperado: true,
    },
  ],
  deve: [terminou(), sugere("cha-alecrim")],
  naoPode: [],
}
