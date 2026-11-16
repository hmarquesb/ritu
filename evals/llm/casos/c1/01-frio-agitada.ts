import { semPalavras, temSugestao, trazGuna, usaItemDaCasa } from "./expectativas"
import type { CasoC1 } from "./tipos"

export const caso01: CasoC1 = {
  id: "c1-01-frio-agitada",
  titulo: "Frio e agitada, casa cheia, Rio frio",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao"],
  cenario: {
    nome: "c1-01",
    descricao: "Frio e agitada, casa cheia, Rio frio",
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
    entrada: {
      texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
      intencoes: ["momento"],
      estados: ["com_frio", "agitada"],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    temSugestao,
    trazGuna("Algo que aquece", ["quente"]),
    trazGuna("Algo que assenta", ["estavel", "pesado", "oleoso"]),
    usaItemDaCasa(["abobora", "arroz-branco", "ghee", "gengibre", "canela"]),
  ],
  naoPode: [
    semPalavras("Sem gelado, cru ou estimulante", [
      "gelado",
      "gelada",
      "cru",
      "crua",
      "estimulante",
      "cafe",
    ]),
  ],
  trajetoria: { chamadas: ["clima.agora", "casa.ler"] },
}
