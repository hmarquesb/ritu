import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { naoSugere, soDosCandidatos } from "./expectativas"

// O mesmo padrão e a mesma casa do caso 7, mas à noite: o chá (manhã e tarde) sai dos candidatos pelo horário; o padrão segue no contexto.
export const casoMemoria08: CasoConversa = {
  tipo: "conversa",
  id: "c3-08-cha-fora-dos-candidatos",
  titulo: "O chá fora dos candidatos à noite",
  cenario: {
    nome: "c3-08",
    descricao:
      "Com frio à noite (21h30); padrão confirmado do chá de gengibre com canela; casa com os dois",
    agora: "2026-06-16T00:30:00.000Z",
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
    mensagem: { texto: "estou com frio depois do trabalho", atalhos: [] },
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
    padroes: [
      {
        tipo: "ajuda_em_estado",
        chave: "com_frio|pratica:cha-gengibre-canela",
        frase: "Quando você está com frio, chá de gengibre com canela costuma te ajudar.",
        ocorrencias: 3,
        status: "confirmado",
      },
    ],
  },
  familia: "memoria",
  deve: [terminou()],
  naoPode: [naoSugere("cha-gengibre-canela"), soDosCandidatos()],
}
