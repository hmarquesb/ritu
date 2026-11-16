import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"

// Saída do agente com os padrões (origem agente, sem avisos, explicação vazia, listas vazias): cada caso põe só o que testa.
export const saidaPronta = (
  p: Partial<SaidaDoAcompanhante> & { resposta: string },
): SaidaDoAcompanhante => ({
  origem: "agente",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
  ...p,
})

// Sugestão de chá pronta: o chá de gengibre com canela, com as linhas da base dos itens e da prática.
export const chaDeGengibre: SugestaoEntregue = {
  tipo: "cha",
  pratica_id: "cha-gengibre-canela",
  titulo: "Chá de gengibre com canela",
  como_fazer:
    "Ferva rodelas de gengibre com um pau de canela por alguns minutos. Coe e beba morno.",
  itens: [
    {
      alimento_id: "gengibre",
      nome: "Gengibre",
      contribui: ["quente"],
      verbos: [],
      linha_base: "alimentos:gengibre",
      casa: "confirmado",
    },
    {
      alimento_id: "canela",
      nome: "Canela",
      contribui: ["quente"],
      verbos: [],
      linha_base: "alimentos:canela",
      casa: "confirmado",
    },
  ],
  verbos: [],
  motivo: "Aquece e dá movimento.",
  linhas_base: ["praticas:cha-gengibre-canela"],
  novidade: false,
}
