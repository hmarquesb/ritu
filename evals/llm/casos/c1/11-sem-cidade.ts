import { comPalavras, semPalavras, temSugestao } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso11: CasoC1 = {
  id: "c1-11-sem-cidade",
  titulo: "Sem cidade",
  cenario: {
    nome: "c1-11",
    descricao: "Sem cidade escolhida",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: { prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 } },
    casa: [{ alimento_id: "gengibre" }, { alimento_id: "canela" }],
    entrada: {
      texto: "Estou agitada e quero me acalmar.",
      intencoes: ["momento"],
      estados: ["agitada"],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    temSugestao,
    comPalavras("Diz que respondeu sem o clima", [
      "sem o clima",
      "sem saber o clima",
      "sem a cidade",
      "sem cidade",
      "nao sei o clima",
      "nao sei onde",
      "nao tenho o clima",
      "nao consegui ver o clima",
      "sem o tempo",
    ]),
  ],
  naoPode: [
    semPalavras("Sem qualidade de clima inventada", [
      "o clima esta",
      "esta frio la fora",
      "esta calor la fora",
      "umido hoje",
    ]),
  ],
}
