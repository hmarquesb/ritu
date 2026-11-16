import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { Preferencia } from "@/core/preferences/ports"
import type { ItemDoCandidato } from "@/core/ranking/tipos"
import type { DefinicaoDoAgente, ToolDeControle } from "@/core/runs/agente"
import type { Checkpoint } from "@/core/runs/checkpoint"
import { novoCheckpoint } from "@/core/runs/loop"
import { createRunService } from "@/core/runs/run-service"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createFixedModel } from "@/infra/fakes/fixed-model"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { askUser, validarPedidoDePergunta } from "./ask-user"

const kb = createMiniKnowledge()

const item = (alimento_id: string, casa: ItemDoCandidato["casa"]): ItemDoCandidato => ({
  alimento_id,
  nome: alimento_id,
  casa,
  contribui: [],
  linha_base: `alimentos:${alimento_id}`,
})

function dados(mudar: Partial<DadosDoPreparo> = {}): DadosDoPreparo {
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
      evitar_gunas: [],
      evitar_marcas: [],
      evitar: [],
      conflitos: [],
      linhas_base: [],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: ["arroz-branco"], incertos: ["abobora", "cenoura"] },
    candidatos: [
      {
        tipo: "refeicao",
        id: "arroz-com-legume",
        nome: "Arroz com legume",
        itens: [item("arroz-branco", "confirmado"), item("abobora", "incerto")],
        opcoes: { legume: [item("abobora", "incerto"), item("cenoura", "incerto")] },
        contribui: [],
        linha_base: "preparos:arroz-com-legume",
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
      itens_confirmados_em_casa: 1,
      itens_incertos_em_casa: 2,
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
    ...mudar,
  }
}

const pref = (item_id: string, mudar: Partial<Preferencia> = {}): Preferencia => ({
  conta_id: "c",
  item_tipo: "alimento",
  item_id,
  gosto: null,
  ajudou: 0,
  nao_ajudou: 0,
  nao_fez: 0,
  ultimos_resultados: [],
  ultima_sugestao_em: null,
  ...mudar,
})

function conferir(
  pedido: Parameters<typeof validarPedidoDePergunta>[0],
  d: DadosDoPreparo = dados(),
  extra: { acabou?: string[]; preferencias?: Preferencia[] } = {},
) {
  return validarPedidoDePergunta(pedido, {
    dados: d,
    acabou: extra.acabou ?? [],
    preferencias: extra.preferencias ?? [],
    kb,
  })
}

describe("validarPedidoDePergunta", () => {
  it("aceita um pedido limpo", () => {
    expect(conferir({ tipo: "casa", alimentos: ["abobora", "cenoura"] })).toBeUndefined()
  })

  it("limite_de_perguntas", () => {
    const d = dados({ perguntas: { feitas: 2, alimentos: [] } })
    expect(conferir({ tipo: "casa", alimentos: ["abobora"] }, d)).toEqual({
      codigo: "limite_de_perguntas",
    })
  })

  it("muitos_itens: mais de 5", () => {
    const ids = ["a", "b", "c", "d", "e", "f"]
    expect(conferir({ tipo: "casa", alimentos: ids })).toEqual({ codigo: "muitos_itens" })
  })

  it("muitos_itens: lista vazia", () => {
    expect(conferir({ tipo: "casa", alimentos: [] })).toEqual({ codigo: "muitos_itens" })
  })

  it("fora_da_base", () => {
    expect(conferir({ tipo: "casa", alimentos: ["abobora", "inexistente"] })).toEqual({
      codigo: "fora_da_base",
      alimentos: ["inexistente"],
    })
  })

  it("ja_confirmado", () => {
    expect(conferir({ tipo: "casa", alimentos: ["abobora", "arroz-branco"] })).toEqual({
      codigo: "ja_confirmado",
      alimentos: ["arroz-branco"],
    })
  })

  it("filtrado", () => {
    const d = dados({
      filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: ["abobora"] },
    })
    expect(conferir({ tipo: "casa", alimentos: ["abobora", "cenoura"] }, d)).toEqual({
      codigo: "filtrado",
      alimentos: ["abobora"],
    })
  })

  it("acabou", () => {
    expect(
      conferir({ tipo: "casa", alimentos: ["cenoura"] }, dados(), { acabou: ["cenoura"] }),
    ).toEqual({ codigo: "acabou", alimentos: ["cenoura"] })
  })

  it("fora_dos_candidatos", () => {
    expect(conferir({ tipo: "casa", alimentos: ["banana"] })).toEqual({
      codigo: "fora_dos_candidatos",
      alimentos: ["banana"],
    })
  })

  it("ja_perguntado", () => {
    const d = dados({ perguntas: { feitas: 1, alimentos: ["abobora"] } })
    expect(conferir({ tipo: "casa", alimentos: ["abobora"] }, d)).toEqual({
      codigo: "ja_perguntado",
      alimentos: ["abobora"],
    })
  })

  it("come_desnecessaria: alimento incerto", () => {
    expect(conferir({ tipo: "come", alimento: "abobora" })).toEqual({
      codigo: "come_desnecessaria",
      alimentos: ["abobora"],
    })
  })

  it("come_desnecessaria: alimento com gosta", () => {
    const d = dados({ casa: { confirmados: ["arroz-branco"], incertos: [] } })
    const preferencias = [pref("abobora", { gosto: "gosta" })]
    expect(conferir({ tipo: "come", alimento: "abobora" }, d, { preferencias })).toEqual({
      codigo: "come_desnecessaria",
      alimentos: ["abobora"],
    })
  })

  it("come_desnecessaria: alimento que já ajudou", () => {
    const d = dados({ casa: { confirmados: ["arroz-branco"], incertos: [] } })
    const preferencias = [pref("abobora", { ajudou: 1 })]
    expect(conferir({ tipo: "come", alimento: "abobora" }, d, { preferencias })?.codigo).toBe(
      "come_desnecessaria",
    )
  })

  it("come passa quando nada o dispensa", () => {
    const d = dados({ casa: { confirmados: ["arroz-branco"], incertos: [] } })
    expect(conferir({ tipo: "come", alimento: "abobora" }, d)).toBeUndefined()
  })
})

function montarCtx(): ToolContext {
  const clock = createFixedClock("2026-11-15T12:00:00Z")
  return {
    kb,
    filtro: filtroVazio,
    sinais: { em_casa: [], gosta: [], ajudou: {} },
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(clock),
    clock,
    telemetry: createMemoryTelemetry(),
  }
}

function estado(d: DadosDoPreparo = dados()): Checkpoint {
  return { ...novoCheckpoint({ nome: "x", prompt_versao: "v" } as DefinicaoDoAgente, "oi", d) }
}

describe("askUser.tratar", () => {
  it("recusa com o código e sem alimentos nos códigos de contagem", async () => {
    const ctx = montarCtx()
    const e = estado(dados({ perguntas: { feitas: 2, alimentos: [] } }))
    const r = await askUser.tratar({ tipo: "casa", alimentos: ["abobora"] }, ctx, e)
    expect(r).toEqual({
      tipo: "recusar",
      resultado: { perguntou: false, motivo: "limite_de_perguntas" },
    })
  })

  it("recusa lista os alimentos que causaram", async () => {
    const r = await askUser.tratar({ tipo: "casa", alimentos: ["banana"] }, montarCtx(), estado())
    expect(r).toEqual({
      tipo: "recusar",
      resultado: { perguntou: false, motivo: "fora_dos_candidatos", alimentos: ["banana"] },
    })
  })

  it("recusa item marcado como acabou em Minha casa", async () => {
    const ctx = montarCtx()
    await ctx.stores.pantry.registrar(ctx.contaId, [{ alimento_id: "cenoura" }], "tela")
    await ctx.stores.pantry.marcarAcabou(ctx.contaId, [{ alimento_id: "cenoura" }])
    const r = await askUser.tratar({ tipo: "casa", alimentos: ["cenoura"] }, ctx, estado())
    expect(r).toMatchObject({ tipo: "recusar", resultado: { motivo: "acabou" } })
  })

  it("recusa item que a mensagem disse que acabou (dados.acabou), com Minha casa vazia", async () => {
    const e = estado(dados({ acabou: ["cenoura"] }))
    const r = await askUser.tratar({ tipo: "casa", alimentos: ["cenoura"] }, montarCtx(), e)
    expect(r).toMatchObject({
      tipo: "recusar",
      resultado: { motivo: "acabou", alimentos: ["cenoura"] },
    })
  })

  it("pedido de casa pausa com a pergunta montada por código", async () => {
    const e = estado()
    const r = await askUser.tratar(
      { tipo: "casa", alimentos: ["abobora", "cenoura"] },
      montarCtx(),
      e,
    )
    expect(r).toEqual({
      tipo: "pausar",
      pendencia: {
        tipo: "pergunta",
        conteudo: {
          origem: "agente",
          pergunta: {
            tipo: "casa",
            texto: "Ainda tem abóbora e cenoura?",
            itens: [
              { alimento_id: "abobora", nome: "Abóbora" },
              { alimento_id: "cenoura", nome: "Cenoura" },
            ],
          },
        },
      },
      resumo: "casa: 2 itens",
    })
    expect((e.dados as DadosDoPreparo).perguntas).toEqual({
      feitas: 1,
      alimentos: ["abobora", "cenoura"],
    })
  })

  it("resumo de um item e do tipo come", async () => {
    const um = await askUser.tratar({ tipo: "casa", alimentos: ["abobora"] }, montarCtx(), estado())
    expect(um).toMatchObject({ resumo: "casa: 1 item" })
    const d = dados({ casa: { confirmados: ["arroz-branco"], incertos: [] } })
    const come = await askUser.tratar({ tipo: "come", alimento: "abobora" }, montarCtx(), estado(d))
    expect(come).toMatchObject({
      tipo: "pausar",
      resumo: "come",
      pendencia: { conteudo: { pergunta: { tipo: "come", texto: "Você come abóbora?" } } },
    })
  })
})

describe("askUser.aoRetomar", () => {
  const perguntaCasa = {
    tipo: "casa",
    texto: "Ainda tem abóbora e cenoura?",
    itens: [
      { alimento_id: "abobora", nome: "Abóbora" },
      { alimento_id: "cenoura", nome: "Cenoura" },
    ],
  } as const

  it("casa: uma resposta, um item ausente e candidatos retirados", () => {
    const r = askUser.aoRetomar?.(
      {
        pergunta: perguntaCasa,
        resposta: { tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "nao_tenho" }] },
        candidatos_retirados: ["arroz-com-legume"],
      },
      estado(),
    )
    expect(r).toEqual({
      respostas: [
        { alimento_id: "abobora", nome: "Abóbora", resposta: "nao_tenho" },
        { alimento_id: "cenoura", nome: "Cenoura", resposta: "pulou" },
      ],
      candidatos_retirados: ["arroz-com-legume"],
    })
  })

  it("pular dá tudo pulou", () => {
    const r = askUser.aoRetomar?.(
      { pergunta: perguntaCasa, resposta: { tipo: "pular" }, candidatos_retirados: [] },
      estado(),
    )
    expect(r).toEqual({
      respostas: [
        { alimento_id: "abobora", nome: "Abóbora", resposta: "pulou" },
        { alimento_id: "cenoura", nome: "Cenoura", resposta: "pulou" },
      ],
      candidatos_retirados: [],
    })
  })

  it("come", () => {
    const pergunta = { tipo: "come", texto: "Você come ovo?", alimento_id: "ovo", nome: "Ovo" }
    expect(
      askUser.aoRetomar?.(
        { pergunta, resposta: { tipo: "come", resposta: "nao_como" }, candidatos_retirados: [] },
        estado(),
      ),
    ).toEqual({ alimento_id: "ovo", nome: "Ovo", resposta: "nao_como" })
    expect(
      askUser.aoRetomar?.(
        { pergunta, resposta: { tipo: "pular" }, candidatos_retirados: [] },
        estado(),
      ),
    ).toEqual({ alimento_id: "ovo", nome: "Ovo", resposta: "pulou" })
  })

  it("retomada inválida", () => {
    expect(askUser.aoRetomar?.({ lixo: true }, estado())).toEqual({ erro: "resposta_invalida" })
  })
})

describe("ask_user no loop", () => {
  const finalizar: ToolDeControle<unknown> = {
    name: "finalizar",
    description: "entrega",
    input: z.object({}),
    async tratar() {
      return { tipo: "entregar", saida: { texto: "oi" } }
    },
  }
  const agente = (controle: ToolDeControle<unknown>[]): DefinicaoDoAgente => ({
    nome: "teste",
    instrucoes: "i",
    prompt_versao: "v1",
    tools: [],
    controle,
    lembreteDeEntrega: "entregue",
  })
  const ask = (a: unknown) => ({ nome: "ask_user", argumentos: a })

  async function rodar(
    roteiro: Parameters<typeof createScriptedRuntime>[0],
    ag: DefinicaoDoAgente,
  ) {
    const clock = createFixedClock("2026-11-15T12:00:00Z")
    const stores = createMemoryStores(clock)
    const telemetry = createMemoryTelemetry()
    const svc = createRunService({
      stores,
      tx: stores,
      runtime: createScriptedRuntime(roteiro, clock),
      clock,
      telemetry,
    })
    const conta = await stores.accounts.criar({ tipo: "demo" })
    const run = await svc.iniciarRun(conta.id, { caminho: "acompanhante", intencoes: [] })
    const ctx: ToolContext = { ...montarCtx(), contaId: conta.id, stores, clock, telemetry }
    return svc.executarRun(conta.id, run.id, {
      agente: ag,
      ctx,
      modelo: createFixedModel(),
      estado: novoCheckpoint(ag, "oi", dados()),
    })
  }

  it("recusa conta em entregas_recusadas", async () => {
    const r = await rodar(
      [
        { chamadas: [ask({ tipo: "casa", alimentos: ["banana"] })] },
        { chamadas: [ask({ tipo: "casa", alimentos: ["abobora"] })] },
      ],
      agente([finalizar, askUser as ToolDeControle<unknown>]),
    )
    expect(r.fim.tipo).toBe("pausa")
    expect(r.run.checkpoint).toMatchObject({ entregas_recusadas: 1 })
  })

  it("pausa grava dados.perguntas no checkpoint", async () => {
    const r = await rodar(
      [{ chamadas: [ask({ tipo: "casa", alimentos: ["abobora"] })] }],
      agente([finalizar, askUser as ToolDeControle<unknown>]),
    )
    expect(r.fim.tipo).toBe("pausa")
    expect(r.run.status).toBe("waiting_for_input")
    const cp = r.run.checkpoint as Checkpoint
    expect((cp.dados as DadosDoPreparo).perguntas).toEqual({ feitas: 1, alimentos: ["abobora"] })
  })

  it("ask_user e finalizar no mesmo passo: vale o primeiro", async () => {
    const r = await rodar(
      [
        {
          chamadas: [
            ask({ tipo: "casa", alimentos: ["abobora"] }),
            { nome: "finalizar", argumentos: {} },
          ],
        },
      ],
      agente([finalizar, askUser as ToolDeControle<unknown>]),
    )
    expect(r.fim.tipo).toBe("pausa")
    const msgs = (r.run.checkpoint as Checkpoint).mensagens
    expect(JSON.stringify(msgs)).toContain('"ignorada":true')
  })
})
