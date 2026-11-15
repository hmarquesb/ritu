import { idsDasSugestoes, semAlimentos, temSugestao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso09: CasoC1 = {
  id: "c1-09-evitar-leite",
  titulo: "Evitar sempre leite; frio à noite",
  cenario: {
    nome: "c1-09",
    descricao: "Evitar sempre leite; momento com frio à noite",
    agora: "2026-06-15T23:00:00.000Z",
    perfil: {
      prakriti: { vata: 0.5, pitta: 0.2, kapha: 0.3 },
      cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
      evitar_sempre: [{ tipo: "alimento", valor: "leite" }],
    },
    casa: [
      { alimento_id: "leite" },
      { alimento_id: "ghee" },
      { alimento_id: "canela" },
      { alimento_id: "gengibre" },
    ],
    clima: { temperatura_aparente: 14, umidade: 80 },
    entrada: {
      texto: "Está frio e já é noite, quero algo quente para dormir melhor.",
      intencoes: ["momento"],
      estados: ["com_frio"],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    temSugestao,
    semAlimentos("Sem laticínio e sem ghee", [
      "leite",
      "ghee",
      "manteiga",
      "iogurte-natural",
      "queijo-minas",
      "ricota",
    ]),
  ],
  naoPode: [
    {
      descricao: "Não sugere leite-morno-com-especiaria",
      confere: (r) => !idsDasSugestoes(r).includes("leite-morno-com-especiaria"),
    },
  ],
}
