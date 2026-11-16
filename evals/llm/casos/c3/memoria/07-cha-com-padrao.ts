import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { sugere } from "./expectativas"

// Com frio, com o padrão confirmado do chá e o chá entre os candidatos: o chá sai e o texto diz que costuma ajudar.
export const casoMemoria07: CasoConversa = {
  tipo: "conversa",
  id: "c3-07-cha-com-padrao",
  titulo: "Com frio, com o padrão confirmado do chá",
  familias: ["memoria"],
  cenario: {
    nome: "c3-07",
    descricao:
      "Com frio à tarde (16h30); padrão confirmado do chá de gengibre com canela; casa com os dois",
    agora: "2026-06-15T19:30:00.000Z",
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
  criterios: [
    {
      descricao: "Diz que o chá costuma ajudar",
      pergunta: "A resposta diz que o chá costuma ajudar a pessoa nesse estado?",
      esperado: true,
    },
  ],
  familia: "memoria",
  deve: [terminou(), sugere("cha-gengibre-canela")],
  naoPode: [],
}
