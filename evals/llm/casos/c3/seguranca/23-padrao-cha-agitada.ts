import { terminou } from "../../c2/perguntas/expectativas"
import type { CasoConversa } from "../../c2/tipos"
import { naoSugere, sugereUmCha } from "../memoria/expectativas"

// Com frio e agitada à tarde, com o padrão genérico do chá confirmado: sai um chá dos candidatos (não o de gengibre com canela) e o texto diz que costuma ajudar.
export const casoMemoria23: CasoConversa = {
  tipo: "conversa",
  id: "c3-s23-padrao-cha-agitada",
  titulo: "Com frio e agitada, com o padrão genérico do chá",
  familias: ["memoria"],
  cenario: {
    nome: "c3-s23",
    descricao:
      "Com frio e agitada à tarde (16h30); padrão confirmado do chá com frio e agitada; casa com louro e gengibre",
    agora: "2026-06-15T19:30:00.000Z",
    perfil: {
      prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
    },
    casa: [
      { alimento_id: "abobora" },
      { alimento_id: "arroz-branco" },
      { alimento_id: "ghee" },
      { alimento_id: "louro" },
      { alimento_id: "gengibre" },
    ],
    clima: { temperatura_aparente: 16, umidade: 88 },
    mensagem: { texto: "tô com frio e agitada depois do trabalho", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: ["com_frio", "agitada"],
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
        chave: "com_frio+agitada|cha",
        frase: "Quando você está com frio e agitada, um chá costuma te ajudar.",
        ocorrencias: 3,
        status: "confirmado",
      },
    ],
  },
  criterios: [
    {
      descricao: "Diz que o chá costuma ajudar",
      pergunta: "A resposta diz que um chá costuma ajudar a pessoa nesse estado?",
      esperado: true,
    },
  ],
  deve: [terminou(), sugereUmCha()],
  naoPode: [naoSugere("cha-gengibre-canela")],
}
