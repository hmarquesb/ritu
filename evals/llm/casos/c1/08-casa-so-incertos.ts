import { semAlimentos } from "./expectativas"
import type { CasoC1 } from "./tipos"

const ALIMENTOS_DA_CASA = ["abobora", "arroz-branco", "gengibre"]

export const caso08: CasoC1 = {
  id: "c1-08-casa-so-incertos",
  titulo: "Casa só com itens incertos",
  tipo: "acompanhante",
  familias: ["conteudo", "fidelidade", "explicacao", "casa"],
  cenario: {
    nome: "c1-08",
    descricao: "Casa só com itens incertos (confirmados há mais de 90 dias)",
    agora: "2026-06-15T22:00:00.000Z",
    perfil: { prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 } },
    casa: ALIMENTOS_DA_CASA.map((alimento_id) => ({ alimento_id, diasDesdeConfirmacao: 120 })),
    clima: { temperatura_aparente: 16, umidade: 88 },
    entrada: {
      texto: "Estou com frio e quero algo quente.",
      intencoes: ["momento"],
      estados: ["com_frio"],
      evitar_da_mensagem: [],
    },
  },
  deve: [
    {
      descricao: "se_faltar em item incerto, ou só práticas sem ingrediente",
      confere: (r) => {
        const itens = r.saida.sugestoes.flatMap((s) => s.itens)
        if (itens.length === 0) return true
        return itens.filter((i) => i.casa === "incerto").every((i) => i.se_faltar !== undefined)
      },
    },
  ],
  naoPode: [
    {
      descricao: "Item ausente",
      confere: (r) => !r.saida.sugestoes.some((s) => s.itens.some((i) => i.casa === "ausente")),
    },
    semAlimentos("Sem item que a casa não tem", ["leite", "ghee", "canela"]),
  ],
  trajetoria: { chamadas: ["casa.ler"] },
}
