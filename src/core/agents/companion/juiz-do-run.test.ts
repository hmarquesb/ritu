import { llmCotas } from "@config/index"
import { describe, expect, it } from "vitest"
import type { Veredito } from "@/core/agents/judge/julgar"
import { filtroVazio } from "@/core/knowledge/filtros"
import { createModelRouter } from "@/core/llm/router"
import { novoCheckpoint } from "@/core/runs/loop"
import type { Run, RunEtapa } from "@/core/runs/ports"
import { createRunService, type ResultadoDoRun } from "@/core/runs/run-service"
import type { ToolContext } from "@/core/tools/tool"
import { createScriptedJudge } from "@/infra/fakes/fake-judge"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { criarAcompanhante } from "./agente"
import { contextoDoRun } from "./contexto-do-run"
import { criarJuizDoRun } from "./juiz-do-run"
import type { DadosDoPreparo } from "./preparo"
import type { EscolhaDoModelo, SaidaDoAcompanhante } from "./saida"

const kb = createMiniKnowledge()
const CONFIRMADOS = ["gengibre", "canela", "cardamomo", "leite", "mel", "arroz-branco", "ghee"]
const TRECHO = "TRECHO-SECRETO-DA-RESPOSTA"
const ROTINA = "Acordo cedo e tomo um chá"

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
        itens: [
          {
            alimento_id: "gengibre",
            nome: "gengibre",
            casa: "confirmado",
            contribui: ["quente"],
            linha_base: "alimentos:gengibre",
          },
        ],
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
    fato_de_rotina: ROTINA,
  }
}

function entrega(mudar: Partial<EscolhaDoModelo> = {}): EscolhaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    sugestoes: [{ tipo: "cha", id: "cha-gengibre", motivo: "Aquece o corpo." }],
    incertos: [],
    ...mudar,
  }
}

const finalizar = (e: EscolhaDoModelo = entrega()): PassoRoteirizado => ({
  chamadas: [{ nome: "finalizar", argumentos: e }],
})
const proporRotina: PassoRoteirizado = {
  chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
}
const OUTRA = entrega({ resposta: "Uma segunda versão, mais calma e sem promessa." })
const RUIM = entrega({ resposta: "" })

function ok(mudar: Partial<Extract<Veredito, { ok: true }>> = {}): Veredito {
  return {
    ok: true,
    aprovado: true,
    graves: [],
    registros: [],
    saude_na_proposta: false,
    apontamentos: [],
    modelo: "modelo-do-juiz",
    tokens: { entrada: 7, saida: 3 },
    trocas: 0,
    duracao_ms: 5,
    ...mudar,
  }
}
function reprovado(motivos: ("promessa" | "tom")[], mais: Partial<Veredito> = {}): Veredito {
  return ok({
    aprovado: false,
    graves: motivos,
    apontamentos: motivos.map((motivo) => ({ motivo, trecho: TRECHO })),
    ...mais,
  } as Partial<Extract<Veredito, { ok: true }>>)
}

const semReforco = {
  ...llmCotas,
  modelos: { ...llmCotas.modelos, "sem-vaga": { rpm: 1, tpm: 1, rpd: 0 } },
  papeis: { ...llmCotas.papeis, reforco: ["sem-vaga"] },
} as unknown as typeof llmCotas

async function montar(
  roteiro: PassoRoteirizado[],
  vereditos: Veredito[] | "lanca",
  opts: { semReforco?: boolean } = {},
) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runtime = createScriptedRuntime(roteiro, clock)
  const router = createModelRouter({
    ledger: createMemoryLedger(clock),
    clock,
    telemetry,
    ...(opts.semReforco ? { cotas: semReforco } : {}),
  })
  const runs = createRunService({ stores, tx: stores, runtime, clock, telemetry })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const judge =
    vereditos === "lanca"
      ? {
          pedidos: [] as { tentativa: number; nota_de_rotina?: string }[],
          async julgar(): Promise<Veredito> {
            throw new Error("quebrou")
          },
        }
      : createScriptedJudge(vereditos)
  const juizDoRun = criarJuizDoRun({ judge, runs, router, kb, telemetry, clock })
  const preparo = dados()
  const agente = criarAcompanhante()
  const ctx: ToolContext = {
    kb,
    filtro: filtroVazio,
    sinais: { em_casa: CONFIRMADOS, gosta: [], ajudou: {} },
    clima: { fonte: createFakeWeather() },
    contaId: conta.id,
    stores,
    clock,
    telemetry,
    run: contextoDoRun(preparo),
    tx: stores,
  }
  const run: Run = await runs.iniciarRun(conta.id, {
    caminho: "acompanhante",
    intencoes: ["momento"],
  })
  const primeiro = await runs.executarRun(conta.id, run.id, {
    agente,
    ctx,
    estado: novoCheckpoint(agente, "mensagem", preparo),
    modelo: router.paraPapel("decisao"),
  })
  const julgar = (resultado: ResultadoDoRun = primeiro) =>
    juizDoRun.julgarEntrega(conta.id, resultado, { dados: preparo, agente, ctx })
  const etapas = () => stores.runs.etapas(conta.id, run.id)
  return { julgar, primeiro, judge, runtime, etapas, telemetry, preparo, run }
}

const saidaDe = (r: ResultadoDoRun): SaidaDoAcompanhante =>
  (r.fim as { saida: SaidaDoAcompanhante }).saida
const doJuiz = async (m: { etapas: () => Promise<RunEtapa[]> }) =>
  (await m.etapas()).filter((e) => e.tipo === "juiz")

describe("criarJuizDoRun.julgarEntrega", () => {
  it("aprovado entrega a saída do agente com uma etapa juiz ok", async () => {
    const m = await montar([finalizar()], [ok()])
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("agente")
    expect(r.campos).toMatchObject({
      juiz_tentativas: 1,
      juiz_aprovado: true,
      tokens: { entrada: 7, saida: 3 },
      apoio: ["modelo-do-juiz"],
      reforco: [],
      trocas_reforco: 0,
    })
    expect(await doJuiz(m)).toMatchObject([
      {
        nome: "juiz",
        resumo: "aprovado",
        status: "ok",
        modelo: "modelo-do-juiz",
        tokens_entrada: 7,
      },
    ])
  })

  it("jargao é registro: entrega e grava os registros no resumo", async () => {
    const m = await montar(
      [finalizar()],
      [ok({ registros: ["jargao"], apontamentos: [{ motivo: "jargao", trecho: TRECHO }] })],
    )
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("agente")
    expect((await doJuiz(m))[0]).toMatchObject({
      resumo: "aprovado; registros: jargao",
      status: "ok",
    })
  })

  it("reprovado e corrigido: a 2ª entrega, validada, é a que sai", async () => {
    const m = await montar(
      [finalizar(), finalizar(RUIM), finalizar(OUTRA)],
      [reprovado(["promessa"]), ok()],
    )
    const r = await m.julgar()
    expect(saidaDe(r.resultado).resposta).toBe(OUTRA.resposta)
    expect(r.campos).toMatchObject({
      juiz_tentativas: 2,
      juiz_aprovado: true,
      reforco: [llmCotas.papeis.reforco[0]],
    })
    const etapas = await m.etapas()
    expect(etapas.filter((e) => e.tipo === "validacao").map((e) => e.status)).toEqual([
      "ok",
      "recusado",
      "ok",
    ])
    expect(etapas.filter((e) => e.tipo === "juiz").map((e) => e.resumo)).toEqual([
      "reprovado: promessa",
      "aprovado",
    ])
    const pedido = m.runtime.pedidos.at(-1)
    const sistema = pedido?.mensagens.find((x) => x.papel === "sistema")
    expect(sistema?.conteudo).toContain("Promete efeito de saúde")
    expect(sistema?.conteudo).toContain(TRECHO)
    expect(pedido?.tools.map((t) => t.name)).not.toContain("ask_user")
    expect(pedido?.tools.map((t) => t.name)).toContain("finalizar")
  })

  it("duas reprovações dão a resposta segura e juiz_aprovado false", async () => {
    const m = await montar(
      [finalizar(), finalizar(OUTRA)],
      [reprovado(["promessa", "tom"]), reprovado(["tom"])],
    )
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("segura")
    expect(r.campos).toMatchObject({ juiz_tentativas: 2, juiz_aprovado: false })
    expect((await doJuiz(m)).map((e) => e.resumo)).toEqual([
      "reprovado: promessa, tom",
      "reprovado: tom",
    ])
  })

  it("reprovado com registro junto grava os dois no resumo", async () => {
    const m = await montar(
      [finalizar()],
      [reprovado(["promessa"], { registros: ["jargao"] }), ok()],
    )
    await m.julgar().catch(() => undefined)
    expect((await doJuiz(m))[0]?.resumo).toBe("reprovado: promessa; registros: jargao")
  })

  it("nova tentativa que bate no limite de chamadas dá a saída segura", async () => {
    const semFim = Array.from({ length: 5 }, () => ({ texto: "pensando" }))
    const m = await montar(
      [...semFim, finalizar(), ...semFim, { texto: "x" }, { texto: "y" }, { texto: "z" }],
      [reprovado(["promessa"])],
    )
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("segura")
    expect(r.campos).toMatchObject({ juiz_tentativas: 1, juiz_aprovado: false })
    expect((await m.etapas()).some((e) => e.nome === "nova_tentativa:limite")).toBe(true)
  })

  it("reforço sem modelo grava nova_tentativa:sem_modelo e entrega a saída segura", async () => {
    const m = await montar([finalizar()], [reprovado(["promessa"])], { semReforco: true })
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("segura")
    expect(r.campos.juiz_aprovado).toBe(false)
    expect((await m.etapas()).some((e) => e.nome === "nova_tentativa:sem_modelo")).toBe(true)
  })

  it("Juiz sem modelo dá a saída segura e a etapa juiz falhou", async () => {
    const m = await montar([finalizar()], [{ ok: false, motivo: "sem_modelo", duracao_ms: 1 }])
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("segura")
    expect(r.campos).toMatchObject({ juiz_tentativas: 1, juiz_aprovado: null, apoio: [] })
    expect(await doJuiz(m)).toMatchObject([
      {
        resumo: "indisponivel",
        status: "falhou",
        modelo: null,
        tokens_entrada: 0,
        tokens_saida: 0,
      },
    ])
  })

  it("Juiz que lança é tratado como indisponível", async () => {
    const m = await montar([finalizar()], "lanca")
    const r = await m.julgar()
    expect(saidaDe(r.resultado).origem).toBe("segura")
    expect(r.campos.juiz_aprovado).toBeNull()
    expect((await doJuiz(m))[0]).toMatchObject({ resumo: "indisponivel", status: "falhou" })
  })

  it("cada entrega segura do Juiz loga resposta_segura com motivo juiz, warn", async () => {
    const m = await montar(
      [finalizar(), finalizar(OUTRA)],
      [reprovado(["promessa", "tom"]), reprovado(["tom"])],
    )
    await m.julgar()
    const logs = m.telemetry.logs.filter((l) => l.codigo === "resposta_segura")
    expect(logs.map((l) => l.campos.motivo)).toEqual(["juiz"])
    expect(logs[0]?.nivel).toBe("warn")
  })

  it("Juiz sem modelo também entrega a saída segura e loga juiz", async () => {
    const m = await montar([finalizar()], [{ ok: false, motivo: "sem_modelo", duracao_ms: 1 }])
    await m.julgar()
    expect(
      m.telemetry.logs.filter((l) => l.codigo === "resposta_segura").map((l) => l.campos.motivo),
    ).toEqual(["juiz"])
  })

  it("saude_na_proposta tira a proposta de rotina e deixa as outras", async () => {
    const m = await montar([proporRotina, finalizar()], [ok({ saude_na_proposta: true })])
    const antes = saidaDe(m.primeiro)
    expect(antes.propostas_do_agente).toMatchObject([{ tool: "memoria.propor", tipo: "rotina" }])
    const comOutra = {
      ...antes,
      propostas_do_agente: [
        ...(antes.propostas_do_agente ?? []),
        { tool: "casa.propor" as const, acao: "tem" as const, itens: [{ nome: "mel" }] },
      ],
    }
    const r = await m.julgar({ ...m.primeiro, fim: { tipo: "entregue", saida: comOutra } })
    expect(saidaDe(r.resultado).propostas_do_agente).toEqual([
      { tool: "casa.propor", acao: "tem", itens: [{ nome: "mel" }] },
    ])
    expect(m.judge.pedidos[0]?.nota_de_rotina).toBe(ROTINA)
  })

  it("saude_na_proposta com um grave tira a rotina da saída da tentativa seguinte", async () => {
    const m = await montar(
      [proporRotina, finalizar(), finalizar(OUTRA)],
      [reprovado(["promessa"], { saude_na_proposta: true }), ok()],
    )
    const r = await m.julgar()
    const final = saidaDe(r.resultado)
    expect(final.resposta).toBe(OUTRA.resposta)
    expect(final.propostas_do_agente).toBeUndefined()
    expect(m.judge.pedidos.map((p) => p.nota_de_rotina)).toEqual([ROTINA, ROTINA])
  })

  it("não chama o Juiz com saída sem_modelo nem com fim limite", async () => {
    const m = await montar([finalizar()], [])
    const semModelo = {
      ...m.primeiro,
      fim: { tipo: "entregue" as const, saida: { origem: "sem_modelo" } },
    }
    const a = await m.julgar(semModelo as ResultadoDoRun)
    const b = await m.julgar({ ...m.primeiro, fim: { tipo: "limite", motivo: "chamadas" } })
    expect(m.judge.pedidos).toEqual([])
    expect(a.resultado).toBe(semModelo)
    expect(b.resultado.fim.tipo).toBe("limite")
    expect(b.campos).toEqual({
      juiz_tentativas: 0,
      juiz_aprovado: null,
      tokens: { entrada: 0, saida: 0 },
      apoio: [],
      reforco: [],
      trocas_reforco: 0,
    })
  })

  it("o trecho não aparece em etapa, span, métrica nem log", async () => {
    const m = await montar([finalizar(), finalizar(OUTRA)], [reprovado(["promessa"]), ok()])
    await m.julgar()
    const visivel = JSON.stringify([
      await m.etapas(),
      m.telemetry.spans,
      m.telemetry.metricas,
      m.telemetry.logs,
    ])
    expect(visivel).not.toContain(TRECHO)
  })
})
