import { describe, expect, it } from "vitest"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { EntregaDoModelo } from "@/core/agents/companion/saida"
import { type CodigoDeViolacao, validarEntrega } from "@/core/agents/companion/validador"
import { qualidadesDoMomento } from "@/core/knowledge/momento"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import { getContainer } from "@/infra/container"

const kb = getContainer().knowledge
const CONFIRMADOS = ["gengibre", "canela", "leite", "mel", "limao", "iogurte-natural", "banana"]
const sinais: SinaisPessoa = { em_casa: CONFIRMADOS, gosta: [], ajudou: {} }
const QUALIDADES = qualidadesDoMomento({ estados: ["com_frio"] }, kb)

type Sugestao = EntregaDoModelo["sugestoes"][number]
type Item = Sugestao["itens"][number]
type Candidato = DadosDoPreparo["candidatos"][number]
type Mudanca = { entrega?: Partial<EntregaDoModelo>; dados?: Partial<DadosDoPreparo> }

const contribuiQuente: Item["contribui"] = ["quente"]

const itemDaPratica = (id: string): Item => ({
  alimento_id: id,
  contribui: id === "gengibre" ? contribuiQuente : [],
  linha_base: `alimentos:${id}`,
})

function cha(id: string, ingredientes: string[] = ["gengibre"]): Sugestao {
  return {
    tipo: "cha",
    pratica_id: id,
    itens: ingredientes.map(itemDaPratica),
    motivo: "Aquece o corpo.",
    linhas_base: [`praticas:${id}`, ...ingredientes.map((i) => `alimentos:${i}`)],
    novidade: false,
  }
}

const iogurteComLimao: Sugestao = {
  tipo: "refeicao",
  preparo_id: "iogurte-batido-com-especiaria",
  itens: [
    {
      alimento_id: "iogurte-natural",
      funcao: "proteina",
      contribui: [],
      linha_base: "alimentos:iogurte-natural",
    },
    { alimento_id: "limao", funcao: "tempero", contribui: [], linha_base: "alimentos:limao" },
  ],
  motivo: "Refresca no fim da tarde.",
  linhas_base: [
    "preparos:iogurte-batido-com-especiaria",
    "alimentos:iogurte-natural",
    "alimentos:limao",
  ],
  novidade: false,
}

const candidatoCha: Candidato = {
  tipo: "cha",
  id: "cha-gengibre",
  nome: "Chá de gengibre",
  itens: [
    {
      alimento_id: "gengibre",
      nome: "Gengibre",
      casa: "confirmado",
      contribui: contribuiQuente,
      linha_base: "alimentos:gengibre",
    },
  ],
  contribui: contribuiQuente,
  linha_base: "praticas:cha-gengibre",
  adequacao: 4,
  nota: 8,
  gosta: false,
  ajudou: 0,
  novidade: false,
  no_fim: false,
}

function dados(mudar: Partial<DadosDoPreparo> = {}): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "jantar",
    geral: true,
    qualidades: QUALIDADES,
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: CONFIRMADOS, incertos: [] },
    candidatos: [candidatoCha],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: CONFIRMADOS.length,
      itens_incertos_em_casa: 0,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
    perguntas: { feitas: 0, alimentos: [] },
    nao_come_do_run: [],
    candidatos_completos: [],
    ...mudar,
  }
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno de gengibre pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [cha("cha-gengibre")],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

function codigosDe(m: Mudanca): CodigoDeViolacao[] {
  return validarEntrega(entrega(m.entrega), { dados: dados(m.dados), kb, sinais }).map(
    (v) => v.codigo,
  )
}

const filtroCom = (parcial: Partial<DadosDoPreparo["filtro"]>): DadosDoPreparo["filtro"] => ({
  evitar: [],
  restricoes: [],
  nao_come: [],
  nao_gosta: [],
  ...parcial,
})

// Um caso por código: cada um é uma mudança sobre a entrega limpa, sobre a base real.
// O tipo Record obriga a cobrir todos os códigos de CodigoDeViolacao.
const CASOS: Record<CodigoDeViolacao, Mudanca> = {
  fora_da_base: { entrega: { sugestoes: [cha("cha-inexistente")] } },
  estrutura: { entrega: { sugestoes: [{ ...cha("cha-gengibre"), itens: [] }] } },
  fora_de_casa: { dados: { casa: { confirmados: [], incertos: [] } } },
  evitar_sempre: {
    dados: { filtro: filtroCom({ evitar: [{ tipo: "alimento", valor: "gengibre" }] }) },
  },
  restricao: {
    entrega: { sugestoes: [cha("cha-gengibre-limao-mel", ["gengibre", "limao", "mel"])] },
    dados: { filtro: filtroCom({ restricoes: ["vegana"] }) },
  },
  nao_come: { dados: { filtro: filtroCom({ nao_come: ["gengibre"] }) } },
  nao_gosta: { dados: { filtro: filtroCom({ nao_gosta: ["gengibre"] }) } },
  contraindicacao: { dados: { estados: ["com_calor"] } },
  combinacao: { entrega: { sugestoes: [iogurteComLimao] } },
  repetida: { dados: { sugeridos_hoje: ["praticas:cha-gengibre"] } },
  linha_base: { entrega: { sugestoes: [{ ...cha("cha-gengibre"), linhas_base: [] }] } },
  qualidades: {
    entrega: {
      explicacao: { qualidades_do_momento: ["pesado"], qualidades_buscadas: ["quente"] },
    },
  },
  novidade: { entrega: { sugestoes: [{ ...cha("cha-gengibre"), novidade: true }] } },
  para_ter: {
    entrega: {
      para_ter: {
        alimento_id: "gengibre",
        vezes: 3,
        contribui: [],
        linha_base: "alimentos:gengibre",
      },
    },
  },
  texto_sem_estrutura: {
    entrega: {
      sugestoes: [],
      incertos: ["confirme em casa"],
      resposta: "Pode usar gengibre fresco.",
    },
  },
  tamanho: { entrega: { resposta: "" } },
  vazia: {
    entrega: {
      sugestoes: [],
      incertos: [],
      resposta: "Me conta mais sobre como você está.",
    },
  },
}

describe("validador sobre a base real", () => {
  it("entrega limpa não aponta nada", () => {
    expect(codigosDe({})).toEqual([])
  })

  it.each(Object.entries(CASOS))("%s: a mudança aponta o código", (codigo, mudanca) => {
    expect(codigosDe(mudanca)).toContain(codigo)
  })
})
