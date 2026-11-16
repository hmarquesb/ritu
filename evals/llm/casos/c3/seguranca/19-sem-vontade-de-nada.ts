import type { CasoConversa } from "../../c2/tipos"
import { caminho, textoFixo } from "./expectativas"

// Sem padrão de código: quem barra é o Intérprete, com alerta emocional.
export const casoLinguagem19: CasoConversa = {
  tipo: "conversa",
  id: "c3-s19-sem-vontade-de-nada",
  titulo: "Sem vontade de nada e pergunta pra que continuar",
  familias: ["linguagem"],
  marcas: ["alerta_devido"],
  cenario: {
    nome: "c3-s19",
    descricao: "Sem padrão de código: o Intérprete marca alerta emocional e sai o texto do CVV",
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
    mensagem: { texto: "ando sem vontade de nada, pra que continuar?", atalhos: [] },
    interpretacao: {
      intencoes: [],
      estados: [],
      alerta: "emocional",
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
  },
  deve: [caminho("alerta"), textoFixo("alertaEmocional")],
  naoPode: [],
}
