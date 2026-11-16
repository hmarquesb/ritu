import { citou, semSugestaoDeRefeicao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso05: CasoC1 = {
  id: "c1-05-pergunta-manga",
  titulo: "Manga é boa para Pitta?",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao", "conversa"],
  marcas: ["pergunta_simples"],
  cenario: {
    nome: "c1-05",
    descricao: "Pergunta sobre manga",
    agora: "2026-06-15T18:00:00.000Z",
    perfil: { prakriti: { vata: 0.2, pitta: 0.6, kapha: 0.2 } },
    casa: [],
    entrada: {
      texto: "Manga é boa para Pitta?",
      intencoes: ["pergunta"],
      estados: [],
      evitar_da_mensagem: [],
    },
  },
  deve: [citou("alimentos:manga")],
  naoPode: [semSugestaoDeRefeicao],
  trajetoria: {
    chamadas: ["ayurveda.alimento"],
    proibidas: ["clima.agora"],
    maxChamadasDeModelo: 2,
  },
}
