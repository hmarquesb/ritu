import { describe, expect, it } from "vitest"
import { listaPropor, memoriaPropor } from "@/core/agents/tools/propostas"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { lerConteudo } from "@/core/proposals/conteudo"
import type { ContextoDoRun, ToolContext } from "@/core/tools/tool"
import { getContainer } from "@/infra/container"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Tools de proposta contra a base real: cada código de recusa, o aceito de cada tool, e o que chega ao bloco.
const kb = getContainer().knowledge
const AGORA = "2026-06-15T22:00:00.000Z"
const FATO = "essa semana você vai almoçar fora todo dia"

function ctxDoRun(run?: ContextoDoRun, filtro: FiltroPessoa = filtroVazio): ToolContext {
  const clock = createFixedClock(AGORA)
  return {
    kb,
    filtro,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: "conta-eval",
    stores: createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) }),
    clock,
    telemetry: createMemoryTelemetry(),
    ...(run ? { run } : {}),
  }
}

// Run de exemplo: gengibre que faltou, com um chá de gengibre como candidato indicado.
const RUN: ContextoDoRun = {
  com_incomodo: false,
  tem_para_ter: false,
  nao_tem: ["gengibre"],
  candidatos: [
    { tipo: "pratica", id: "cha-gengibre", nome: "Chá de gengibre", alimentos: ["gengibre"] },
  ],
  na_lista: [],
  lista_recusada: [],
  notas_ativas: [],
}
const RUN_COM_FATO: ContextoDoRun = { ...RUN, fato_de_rotina: "Caminho antes do café" }
const PEDIDO_LISTA = { alimento_id: "gengibre", pratica_id: "cha-gengibre" }

const RECUSAS_MEMORIA: { motivo: string; run: ContextoDoRun }[] = [
  { motivo: "com_incomodo", run: { ...RUN_COM_FATO, com_incomodo: true } },
  { motivo: "sem_fato", run: RUN },
  { motivo: "fato_com_incomodo", run: { ...RUN, fato_de_rotina: "Acordo com dor de cabeça" } },
  { motivo: "ja_anotado", run: { ...RUN_COM_FATO, notas_ativas: ["caminho antes do café"] } },
]

type RecusaDeLista = {
  motivo: string
  run: ContextoDoRun
  pedido?: { alimento_id: string; pratica_id?: string; preparo_id?: string }
  filtro?: FiltroPessoa
}

const RECUSAS_LISTA: RecusaDeLista[] = [
  { motivo: "com_incomodo", run: { ...RUN, com_incomodo: true } },
  {
    motivo: "fora_da_base",
    run: {
      ...RUN,
      nao_tem: ["nao-existe-na-base"],
      candidatos: [
        { tipo: "pratica", id: "cha-gengibre", nome: "Chá", alimentos: ["nao-existe-na-base"] },
      ],
    },
    pedido: { alimento_id: "nao-existe-na-base", pratica_id: "cha-gengibre" },
  },
  { motivo: "sem_nao_tenho", run: { ...RUN, nao_tem: [] } },
  { motivo: "com_para_ter", run: { ...RUN, tem_para_ter: true } },
  {
    motivo: "fora_do_candidato",
    run: {
      ...RUN,
      candidatos: [{ tipo: "pratica", id: "cha-gengibre", nome: "Chá", alimentos: ["limao"] }],
    },
  },
  { motivo: "ja_na_lista", run: { ...RUN, na_lista: ["gengibre"] } },
  { motivo: "ja_recusado", run: { ...RUN, lista_recusada: ["gengibre"] } },
  {
    motivo: "filtrado",
    run: RUN,
    filtro: { ...filtroVazio, evitar: [{ tipo: "alimento", valor: "gengibre" }] },
  },
]

describe("memoria.propor: cada código de recusa", () => {
  it.each(RECUSAS_MEMORIA)("recusa com $motivo", async ({ motivo, run }) => {
    expect(await memoriaPropor.execute({ tipo: "rotina" }, ctxDoRun(run))).toEqual({
      proposto: false,
      motivo,
    })
  })

  it("aceita o fato de rotina como proposta de rotina", async () => {
    expect(await memoriaPropor.execute({ tipo: "rotina" }, ctxDoRun(RUN_COM_FATO))).toEqual({
      proposto: true,
      proposta: { tool: "memoria.propor", tipo: "rotina", texto: "Caminho antes do café" },
    })
  })
})

describe("lista.propor: cada código de recusa", () => {
  it.each(RECUSAS_LISTA)("recusa com $motivo", async ({ motivo, run, pedido, filtro }) => {
    const r = await listaPropor.execute(pedido ?? PEDIDO_LISTA, ctxDoRun(run, filtro))
    expect(r).toEqual({ proposto: false, motivo })
  })

  it("aceita o alimento que faltou no candidato indicado", async () => {
    expect(await listaPropor.execute(PEDIDO_LISTA, ctxDoRun(RUN))).toEqual({
      proposto: true,
      proposta: {
        tool: "lista.propor",
        alimento_id: "gengibre",
        motivo: "faltou_hoje",
        detalhe: "Chá de gengibre",
      },
    })
  })
})

// Cenário que passa pela conversa, com o bloco aberto e sem decisão.
function abrirComRoteiro(base: CenarioDeConversa, roteiro: CenarioDeConversa["roteiro"]) {
  return { ...base, aprovacao: undefined, depois: undefined, roteiro }
}

function base(nome: string): CenarioDeConversa {
  const c = cenariosComAprovacao[nome] ?? cenariosComPausa[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

async function rodar(c: CenarioDeConversa) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, rodada, runId: rodada.final.run_id }
}

async function conteudosDoRun(deps: DepsDoCenario, contaId: string, runId: string) {
  const doRun = await deps.stores.proposals.doRun(contaId, runId)
  return doRun.map((p) => lerConteudo(p.tool, p.conteudo))
}

// Entrega com incerto, que vale como resposta (sem sugestão, o validador exige um incerto).
const ENTREGA = {
  resposta: "Para agora, algo morno e simples. Se puder, sente-se para comer, sem tela.",
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}
// Sem incerto e sem sugestão: o validador recusa com "vazia", e a entrega volta ao modelo.
const ENTREGA_RECUSADA = { ...ENTREGA, incertos: [] }

// Dor de cabeça com a entrega que o fixture usa (o aviso de incômodo vem no evitar).
const ENTREGA_DA_DOR = {
  resposta:
    "Com essa dor de cabeça latejante, vale evitar picantes, frituras e sol forte no almoço. Escolha algo leve e morno, e beba água aos goles. Se a dor for forte ou continuar, procure uma pessoa de saúde.",
  explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["frio", "brando"] },
  sugestoes: [],
  evitar: ["incomodos:dor-de-cabeca/latejante"],
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}

describe("no run: o que chega ao bloco", () => {
  it("memoria.propor e finalizar no mesmo passo: a rotina entra no bloco", async () => {
    const c = abrirComRoteiro(base("aprovacao-parcial"), [
      {
        texto: "Vou anotar a rotina e responder.",
        chamadas: [
          { nome: "memoria.propor", argumentos: { tipo: "rotina" } },
          { nome: "finalizar", argumentos: ENTREGA },
        ],
      },
    ])

    const { contaId, deps, rodada, runId } = await rodar(c)

    expect(rodada.final.status).toBe("waiting_for_approval")
    const rotinas = (await conteudosDoRun(deps, contaId, runId)).filter(
      (x) => x?.tool === "memoria.propor" && x.tipo === "rotina",
    )
    expect(rotinas).toEqual([expect.objectContaining({ texto: FATO })])
  })

  it("memoria.propor chamada duas vezes no mesmo passo: uma linha no bloco", async () => {
    const c = abrirComRoteiro(base("aprovacao-parcial"), [
      {
        texto: "Vou anotar a rotina duas vezes e responder.",
        chamadas: [
          { nome: "memoria.propor", argumentos: { tipo: "rotina" } },
          { nome: "memoria.propor", argumentos: { tipo: "rotina" } },
          { nome: "finalizar", argumentos: ENTREGA },
        ],
      },
    ])

    const { contaId, deps, rodada, runId } = await rodar(c)

    expect(rodada.final.status).toBe("waiting_for_approval")
    const rotinas = (await conteudosDoRun(deps, contaId, runId)).filter(
      (x) => x?.tool === "memoria.propor" && x.tipo === "rotina",
    )
    expect(rotinas).toHaveLength(1)
    expect(rodada.final.saida?.propostas.filter((p) => p.tool === "memoria.propor")).toHaveLength(1)
  })

  it("com incômodo na run, memoria.propor não aceita nenhuma das duas", async () => {
    const dor = base("dor-de-cabeca")
    if (!dor.interpretacao) throw new Error("cenário sem interpretação")
    const c: CenarioDeConversa = {
      ...dor,
      aprovacao: undefined,
      depois: undefined,
      interpretacao: { ...dor.interpretacao, fato_de_rotina: FATO },
      roteiro: [
        {
          texto: "Vou anotar a rotina duas vezes.",
          chamadas: [
            { nome: "memoria.propor", argumentos: { tipo: "rotina" } },
            { nome: "memoria.propor", argumentos: { tipo: "rotina" } },
          ],
        },
        {
          texto: "Vou responder com cuidado.",
          chamadas: [{ nome: "finalizar", argumentos: ENTREGA_DA_DOR }],
        },
      ],
    }

    const { contaId, deps, rodada, runId } = await rodar(c)

    expect(rodada.final.status).toBe("done")
    expect(await conteudosDoRun(deps, contaId, runId)).toEqual([])
  })

  it("lista.propor aceita, mas a entrega segue recusada até o limite: a lista não entra no bloco", async () => {
    const faltou = base("faltou-hoje")
    const tentativasRecusadas = Array.from({ length: 3 }, () => ({
      texto: "Vou responder.",
      chamadas: [{ nome: "finalizar", argumentos: ENTREGA_RECUSADA }],
    }))
    const c = abrirComRoteiro(faltou, [...faltou.roteiro.slice(0, 3), ...tentativasRecusadas])

    const { contaId, deps, rodada, runId } = await rodar(c)

    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida?.origem).toBe("segura")
    expect(rodada.final.saida?.propostas ?? []).toEqual([])
    expect(await conteudosDoRun(deps, contaId, runId)).toEqual([])
  })

  it("controle: com a entrega aceita, a mesma lista entra no bloco", async () => {
    const faltou = base("faltou-hoje")
    const c = abrirComRoteiro(faltou, [
      ...faltou.roteiro.slice(0, 3),
      { texto: "Vou responder.", chamadas: [{ nome: "finalizar", argumentos: ENTREGA }] },
    ])

    const { contaId, deps, rodada, runId } = await rodar(c)

    expect(rodada.final.status).toBe("waiting_for_approval")
    const listas = (await conteudosDoRun(deps, contaId, runId)).filter(
      (x) => x?.tool === "lista.propor",
    )
    expect(listas).toEqual([expect.objectContaining({ alimento_id: "gengibre" })])
  })
})
