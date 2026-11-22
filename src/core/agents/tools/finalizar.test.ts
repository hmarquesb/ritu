import { describe, expect, it } from "vitest"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { EntregaDoModelo } from "@/core/agents/companion/saida"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { MensagemDoLoop } from "@/core/runs/agent-runtime"
import type { DefinicaoDoAgente } from "@/core/runs/agente"
import type { Checkpoint } from "@/core/runs/checkpoint"
import { executarTrecho, novoCheckpoint } from "@/core/runs/loop"
import type { ContextoDoRun, Tool, ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { finalizar, resumoDaValidacao } from "./finalizar"
import { listaPropor, memoriaPropor } from "./propostas"

const kb = createMiniKnowledge()
const CONFIRMADOS = ["gengibre", "canela", "cardamomo", "leite", "mel", "arroz-branco", "ghee"]

function dados(): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "tarde",
    geral: false,
    qualidades: {
      presentes: ["frio"],
      buscadas: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar: [],
      conflitos: [],
      linhas_base: ["estados:com_frio"],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: CONFIRMADOS, incertos: [] },
    candidatos: [
      {
        tipo: "cha",
        id: "cha-gengibre",
        nome: "cha-gengibre",
        itens: [],
        contribui: ["quente"],
        linha_base: "praticas:cha-gengibre",
        adequacao: 1,
        nota: 1,
        gosta: false,
        ajudou: 0,
        novidade: false,
        no_fim: false,
      },
    ],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 7,
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
    acabou: [],
    nao_tem_do_run: [],
    candidatos_do_preparo: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
    retornos_pendentes: [],
  }
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [
      {
        tipo: "cha",
        pratica_id: "cha-gengibre",
        itens: [
          { alimento_id: "gengibre", contribui: ["quente"], linha_base: "alimentos:gengibre" },
        ],
        motivo: "Aquece o corpo.",
        linhas_base: ["praticas:cha-gengibre", "alimentos:gengibre"],
        novidade: false,
      },
    ],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

function estado(mensagens: MensagemDoLoop[] = [], dadosDoRun: unknown = dados()): Checkpoint {
  return {
    versao: 1,
    agente: "acompanhante",
    prompt_versao: "acompanhante.v2",
    mensagens,
    chamadas_de_modelo: 0,
    tokens: { entrada: 0, saida: 0 },
    entregas_recusadas: 1,
    pausas: 0,
    ativo_ms: 0,
    dados: dadosDoRun,
  }
}

function ctx() {
  const telemetry = createMemoryTelemetry()
  const clock = createFixedClock("2026-11-15T12:00:00Z")
  const c: ToolContext = {
    kb,
    filtro: filtroVazio,
    sinais: { em_casa: CONFIRMADOS, gosta: [], ajudou: {} },
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(clock),
    clock,
    telemetry,
  }
  return { c, telemetry }
}

const climaMsg = (resultado: unknown, id = "c1"): MensagemDoLoop => ({
  papel: "tool",
  chamada_id: id,
  nome: "clima.agora",
  resultado,
})

const comQuente = entrega({
  explicacao: { qualidades_do_momento: ["frio", "quente"], qualidades_buscadas: ["quente"] },
})

describe("finalizar", () => {
  it("tem nome, descrição e entrada da spec", () => {
    expect(finalizar.name).toBe("finalizar")
    expect(finalizar.input.safeParse(entrega()).success).toBe(true)
  })

  it("entrega limpa devolve a saída completa e registra o span", async () => {
    const { c, telemetry } = ctx()

    const r = await finalizar.tratar(entrega(), c, estado())

    expect(r.tipo).toBe("entregar")
    if (r.tipo === "entregar") {
      expect((r.saida as { origem: string }).origem).toBe("agente")
    }
    const span = telemetry.spans.find((s) => s.nome === "validacao")
    expect(span?.atributos).toEqual({
      "validacao.tentativa": 2,
      "validacao.ok": true,
      "validacao.violacoes": 0,
    })
    expect(telemetry.metricas).toHaveLength(0)
  })

  it("entrega com violação recusa e soma a métrica por código", async () => {
    const { c, telemetry } = ctx()

    const r = await finalizar.tratar(entrega({ resposta: "" }), c, estado())

    expect(r.tipo).toBe("recusar")
    const res = (r as { resultado: { entregue: boolean; violacoes: { codigo: string }[] } })
      .resultado
    expect(res.entregue).toBe(false)
    expect(res.violacoes.map((v) => v.codigo)).toContain("tamanho")
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_validacao_violacoes_total",
        rotulos: { violacao: "tamanho" },
      }),
    )
    const span = telemetry.spans.find((s) => s.nome === "validacao")
    expect(span?.atributos["validacao.ok"]).toBe(false)
  })

  it("o resumo da validação é ok ao aprovar e os códigos ao recusar", async () => {
    const ok = await finalizar.tratar(entrega(), ctx().c, estado())
    const no = await finalizar.tratar(entrega({ resposta: "" }), ctx().c, estado())
    expect(ok.tipo === "entregar" && ok.resumo).toBe("ok")
    expect(no.tipo === "recusar" && no.resumo).toBe("tamanho")
  })

  it("resumoDaValidacao tira repetidas e mantém a ordem", () => {
    const v = ["fora_de_casa", "evitar_sempre", "fora_de_casa"].map((codigo) => ({ codigo }))
    expect(resumoDaValidacao(v)).toBe("fora_de_casa,evitar_sempre")
    expect(resumoDaValidacao([])).toBe("ok")
  })

  it("clima ok mais recente vale para as qualidades; sem ele a entrega é recusada", async () => {
    const quente = climaMsg({ status: "ok", gunas: ["quente"] })

    const sem = await finalizar.tratar(comQuente, ctx().c, estado())
    const com = await finalizar.tratar(comQuente, ctx().c, estado([quente]))
    const indisponivelDepois = await finalizar.tratar(
      comQuente,
      ctx().c,
      estado([quente, climaMsg({ status: "indisponivel" }, "c2")]),
    )

    expect(sem.tipo).toBe("recusar")
    expect(com.tipo).toBe("entregar")
    expect(indisponivelDepois.tipo).toBe("entregar")
  })

  it("dados fora do schema lançam", async () => {
    await expect(finalizar.tratar(entrega(), ctx().c, estado([], { versao: 2 }))).rejects.toThrow()
  })

  it("o span não leva texto da pessoa", async () => {
    const { c, telemetry } = ctx()

    await finalizar.tratar(entrega(), c, estado())

    const texto = JSON.stringify(telemetry.spans)
    expect(texto).not.toContain("Um chá morno")
  })
})

describe("finalizar com as propostas do agente", () => {
  const NOTA = "Almoço fora às terças"
  const run: ContextoDoRun = {
    fato_de_rotina: NOTA,
    com_incomodo: false,
    tem_para_ter: false,
    nao_tem: ["gengibre"],
    candidatos: [
      { tipo: "cha", id: "cha-gengibre", nome: "Chá de gengibre", alimentos: ["gengibre"] },
    ],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
  }
  const agente: DefinicaoDoAgente = {
    nome: "teste",
    instrucoes: "instr",
    prompt_versao: "v1",
    tools: [memoriaPropor, listaPropor] as unknown as Tool<unknown, unknown>[],
    controle: [finalizar as never],
    lembreteDeEntrega: "entregue por finalizar",
  }
  const memoria = { nome: "memoria.propor", argumentos: { tipo: "rotina" } }
  const lista = {
    nome: "lista.propor",
    argumentos: { alimento_id: "gengibre", pratica_id: "cha-gengibre" },
  }
  const fin = (mudar: Partial<EntregaDoModelo> = {}) => ({
    nome: "finalizar",
    argumentos: entrega(mudar),
  })

  async function rodar(roteiro: PassoRoteirizado[], fatoDeRotina: string | undefined = NOTA) {
    const { c, telemetry } = ctx()
    const clock = createFixedClock("2026-11-15T12:00:00Z")
    const contexto: ToolContext = {
      ...c,
      run: { ...run, ...(fatoDeRotina ? { fato_de_rotina: fatoDeRotina } : {}) },
    }
    const { fim } = await executarTrecho(
      agente,
      novoCheckpoint(agente, "mensagem", dados()),
      contexto,
      {
        runtime: createScriptedRuntime(roteiro, clock),
        modelo: createFixedModel(),
        clock,
        telemetry,
        gravarEtapa: async () => undefined,
      },
    )
    if (fim.tipo !== "entregue") throw new Error(`fim inesperado: ${fim.tipo}`)
    return fim.saida as { propostas_do_agente?: unknown[] }
  }

  const rotina = { tool: "memoria.propor", tipo: "rotina", texto: NOTA }

  it("memoria.propor e finalizar no mesmo passo entregam com a nota", async () => {
    const saida = await rodar([{ chamadas: [memoria, fin()] }])

    expect(saida.propostas_do_agente).toEqual([rotina])
  })

  it("finalizar num passo seguinte também leva a proposta", async () => {
    const saida = await rodar([{ chamadas: [memoria] }, { chamadas: [fin()] }])

    expect(saida.propostas_do_agente).toEqual([rotina])
  })

  it("memoria.propor recusada não entra e o campo some", async () => {
    const saida = await rodar([{ chamadas: [memoria, fin()] }], "Estou com dor de cabeça")

    expect(saida).not.toHaveProperty("propostas_do_agente")
  })

  it("finalizar recusado e depois aceito traz a proposta aceita antes", async () => {
    const saida = await rodar([
      { chamadas: [memoria] },
      { chamadas: [fin({ resposta: "" })] },
      { chamadas: [fin()] },
    ])

    expect(saida.propostas_do_agente).toEqual([rotina])
  })

  it("lista.propor aceita duas vezes fica só com a primeira", async () => {
    const saida = await rodar([{ chamadas: [lista, lista, fin()] }])

    expect(saida.propostas_do_agente).toEqual([
      {
        tool: "lista.propor",
        alimento_id: "gengibre",
        motivo: "faltou_hoje",
        detalhe: "Chá de gengibre",
      },
    ])
  })
})
