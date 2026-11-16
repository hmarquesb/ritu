import { describe, expect, it } from "vitest"
import { type SaidaDoAcompanhante, saidaDoAcompanhanteSchema } from "@/core/agents/companion/saida"
import { createKnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento } from "@/core/knowledge/schemas"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { miniDados } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { responderTroca, trocarIngrediente } from "./troca"

// Mini-base com mais especiarias quentes e leves, para haver o que escolher e filtrar.
const EXTRAS = ["cravo", "louro", "alecrim", "anis-estrelado", "cominho", "curcuma"]
const OUTROS = ["cardamomo", ...EXTRAS]

function kbDoTeste() {
  const modelo = miniDados.alimentos.find((a) => a.id === "cardamomo") as Alimento
  const extras = EXTRAS.map((id) => ({
    ...modelo,
    id,
    nome: id.charAt(0).toUpperCase() + id.slice(1),
  }))
  return createKnowledgeBase(
    { ...miniDados, alimentos: [...miniDados.alimentos, ...extras] },
    { cobertura: false },
  )
}

const CONTA = "c1"
const DIA = "2026-05-10"

type Montagem = Awaited<ReturnType<typeof montar>>

async function montar(evitar: SaidaDoAcompanhante["evitar"] = []) {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const deps: Deps = { tx: stores, stores, kb: kbDoTeste(), clock, telemetry }
  const run = await stores.runs.criar(CONTA, { caminho: "acompanhante", intencoes: [], dia: DIA })
  const [retorno] = await stores.outcomes.criar(CONTA, run.id, [
    {
      tipo: "cha",
      pratica_id: "cha-gengibre-canela",
      alimentos: ["gengibre", "canela"],
      titulo: "Chá de gengibre com canela",
    },
  ])
  if (!retorno) throw new Error("sem retorno")
  const item = (id: string, nome: string) => ({
    alimento_id: id,
    nome,
    contribui: ["quente" as const],
    verbos: ["aquecem"],
    linha_base: `alimentos:${id}`,
    casa: "ausente" as const,
  })
  const saida = saidaDoAcompanhanteSchema.parse({
    origem: "agente",
    resposta: "Um chá.",
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
    sugestoes: [
      {
        tipo: "cha",
        pratica_id: "cha-gengibre-canela",
        retorno_id: retorno.id,
        titulo: "Chá de gengibre com canela",
        como_fazer: "Ferva.",
        itens: [item("gengibre", "Gengibre"), item("canela", "Canela")],
        verbos: [],
        motivo: "aquece",
        linhas_base: [],
        novidade: false,
      },
    ],
    evitar,
    incertos: [],
    citados: [],
    anotacoes: [],
  })
  await stores.runs.atualizar(CONTA, run.id, { saida })
  return { clock, stores, telemetry, deps, runId: run.id, retornoId: retorno.id }
}

const emCasa = (m: Montagem, ids: string[]) =>
  m.stores.pantry.registrar(
    CONTA,
    ids.map((alimento_id) => ({ alimento_id })),
    "tela",
  )

const trocar = (
  m: Montagem,
  alimento_id: string,
  motivo: "trocar" | "nao_tenho" | "nao_gosto" = "trocar",
  conta = CONTA,
) => trocarIngrediente(m.deps, conta, { runId: m.runId, sugestao: 0, alimento_id, motivo })

async function saidaDoRun(m: Montagem) {
  const run = await m.stores.runs.buscar(CONTA, m.runId)
  return saidaDoAcompanhanteSchema.parse(run?.saida)
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

const metricas = (m: Montagem, nome: string) => m.telemetry.metricas.filter((x) => x.nome === nome)

describe("trocarIngrediente", () => {
  it("troca por um confirmado em casa e grava saída, retorno e já sugerido", async () => {
    const m = await montar()
    await emCasa(m, ["cardamomo"])
    const r = await trocar(m, "canela")
    expect(r.resultado).toBe("trocou")
    if (r.resultado !== "trocou") return
    const item = r.sugestao.itens[1]
    expect(item).toMatchObject({ alimento_id: "canela", nome: "Canela" })
    expect(item?.troca).toMatchObject({
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      frase: "Troquei canela por cardamomo: os dois aquecem e aliviam o peso.",
      linha_base: "alimentos:cardamomo",
      anteriores: [],
      contribui: ["quente"],
    })
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca?.alimento_id).toBe("cardamomo")
    const [retorno] = await m.stores.outcomes.pendentes(CONTA)
    expect(retorno?.sugestao.alimentos).toEqual(["gengibre", "cardamomo"])
    const pref = (await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "cardamomo" }]))[0]
    expect(pref?.ultima_sugestao_em).not.toBeNull()
    expect(metricas(m, "ritu_troca_ingrediente_total")).toMatchObject([
      { rotulos: { resultado: "trocou" } },
    ])
  })

  it("não troca por um item que já está na sugestão", async () => {
    const m = await montar()
    await emCasa(m, ["gengibre"])
    const r = await trocar(m, "canela")
    expect(r.resultado).not.toBe("trocou")
  })

  it.each([
    [
      "evitar sempre",
      (m: Montagem) =>
        m.stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "alimento", valor: "cravo" }]),
    ],
    [
      "não como",
      (m: Montagem) =>
        m.stores.profiles.definirNaoCome(CONTA, [{ tipo: "alimento", valor: "cravo" }]),
    ],
    [
      "não gosto",
      (m: Montagem) =>
        m.stores.preferences.definirGosto(CONTA, { tipo: "alimento", id: "cravo" }, "nao_gosta"),
    ],
    [
      "evitar do dia",
      (m: Montagem) =>
        m.stores.profiles.acrescentarEvitarTemporario(CONTA, DIA, [
          { tipo: "alimento", valor: "cravo" },
        ]),
    ],
  ])("nunca escolhe quem está em %s", async (_, bloquear) => {
    const m = await montar()
    await bloquear(m)
    await emCasa(m, ["cravo", "louro"])
    const r = await trocar(m, "canela")
    expect(r).toMatchObject({ resultado: "trocou" })
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca?.alimento_id).toBe("louro")
  })

  it("nunca escolhe quem está em saida.evitar", async () => {
    const m = await montar([{ texto: "cravo", linha_base: "alimentos:cravo" }])
    await emCasa(m, ["cravo", "louro"])
    await trocar(m, "canela")
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca?.alimento_id).toBe("louro")
  })

  it("trocar de novo parte do id efetivo e não repete original nem anteriores", async () => {
    const m = await montar()
    await emCasa(m, ["cravo", "louro", "canela"])
    await trocar(m, "canela")
    const r = await trocar(m, "cravo")
    expect(r.resultado).toBe("trocou")
    const troca = (await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca
    expect(troca?.anteriores).toEqual(["cravo"])
    expect(["canela", "cravo"]).not.toContain(troca?.alimento_id)
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.alimento_id).toBe("canela")
  })

  it("segundo toque no id que já saiu é toque_invalido", async () => {
    const m = await montar()
    await emCasa(m, ["cravo"])
    await trocar(m, "canela")
    expect(await erroDe(trocar(m, "canela"))).toMatchObject({ code: "toque_invalido" })
  })

  it("no teto de trocas devolve sem_substituto e não muda a sugestão", async () => {
    const m = await montar()
    await emCasa(m, [
      "alecrim",
      "anis-estrelado",
      "cebolinha",
      "cominho",
      "cravo",
      "curcuma",
      "louro",
    ])
    let id = "canela"
    for (let i = 0; i < 3; i++) {
      const r = await trocar(m, id)
      expect(r.resultado).toBe("trocou")
      if (r.resultado === "trocou") id = r.sugestao.itens[1]?.troca?.alimento_id ?? ""
    }
    const antes = await saidaDoRun(m)
    const r = await trocar(m, id)
    expect(r).toEqual({
      resultado: "sem_substituto",
      texto: "Não achei uma troca para canela com o que você tem em casa.",
    })
    expect(await saidaDoRun(m)).toEqual(antes)
    expect(metricas(m, "ritu_troca_ingrediente_total").at(-1)?.rotulos).toEqual({
      resultado: "sem_substituto",
    })
  })

  it("sem confirmado, pergunta por um incerto ou nunca registrado, nunca por quem acabou", async () => {
    const m = await montar()
    const primeira = await trocar(m, "canela")
    expect(primeira.resultado).toBe("perguntar")
    if (primeira.resultado !== "perguntar") return
    expect(primeira.pergunta.texto).toMatch(/em casa\?$/)
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca).toBeUndefined()
    const id = primeira.pergunta.alimento_id
    await m.stores.pantry.registrar(CONTA, [{ alimento_id: id }], "tela")
    await m.stores.pantry.marcarAcabou(CONTA, [{ alimento_id: id }])
    const segunda = await trocar(m, "canela")
    expect(segunda.resultado).toBe("perguntar")
    if (segunda.resultado === "perguntar") expect(segunda.pergunta.alimento_id).not.toBe(id)
  })

  it("sem nenhum candidato possível devolve sem_substituto", async () => {
    const m = await montar()
    const ids = OUTROS
    await emCasa(m, ids)
    await m.stores.pantry.marcarAcabou(
      CONTA,
      ids.map((alimento_id) => ({ alimento_id })),
    )
    const r = await trocar(m, "canela")
    expect(r.resultado).toBe("sem_substituto")
  })

  it("motivo nao_tenho marca acabou, grava a falta e troca no mesmo pedido", async () => {
    const m = await montar()
    await emCasa(m, ["canela", "cravo"])
    const r = await trocar(m, "canela", "nao_tenho")
    expect(r.resultado).toBe("trocou")
    const casa = await m.stores.pantry.listar(CONTA)
    expect(casa.find((i) => i.alimento_id === "canela")?.estado).toBe("acabou")
    expect(await m.stores.shortages.diasComFalta(CONTA, DIA)).toEqual([
      { alimento_id: "canela", dias: 1, ultimo_dia: DIA },
    ])
    expect(metricas(m, "ritu_faltas_total")).toMatchObject([{ rotulos: { origem: "nao_tenho" } }])
  })

  it("motivo nao_gosto grava nao_gosta e troca", async () => {
    const m = await montar()
    await emCasa(m, ["cravo"])
    const r = await trocar(m, "canela", "nao_gosto")
    expect(r.resultado).toBe("trocou")
    const pref = (await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "canela" }]))[0]
    expect(pref?.gosto).toBe("nao_gosta")
    expect(metricas(m, "ritu_gosto_total")).toMatchObject([{ rotulos: { gosto: "nao_gosta" } }])
  })

  it("o que o motivo gravou fica gravado mesmo sem substituto", async () => {
    const m = await montar()
    const ids = OUTROS
    await emCasa(m, ids)
    await m.stores.pantry.marcarAcabou(
      CONTA,
      ids.map((alimento_id) => ({ alimento_id })),
    )
    const r = await trocar(m, "canela", "nao_gosto")
    expect(r.resultado).toBe("sem_substituto")
    const pref = (await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "canela" }]))[0]
    expect(pref?.gosto).toBe("nao_gosta")
  })

  it("toque inválido não grava nada", async () => {
    const m = await montar()
    await emCasa(m, ["cravo"])
    const antes = await saidaDoRun(m)
    const invalidos = [
      trocarIngrediente(m.deps, "outra", {
        runId: m.runId,
        sugestao: 0,
        alimento_id: "canela",
        motivo: "nao_gosto",
      }),
      trocarIngrediente(m.deps, CONTA, {
        runId: m.runId,
        sugestao: 5,
        alimento_id: "canela",
        motivo: "nao_gosto",
      }),
      trocarIngrediente(m.deps, CONTA, {
        runId: m.runId,
        sugestao: 0,
        alimento_id: "mamao",
        motivo: "nao_gosto",
      }),
      trocarIngrediente(m.deps, CONTA, {
        runId: "nao-existe",
        sugestao: 0,
        alimento_id: "canela",
        motivo: "nao_gosto",
      }),
    ]
    for (const p of invalidos) expect(await erroDe(p)).toMatchObject({ code: "toque_invalido" })
    expect(await saidaDoRun(m)).toEqual(antes)
    expect(await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "canela" }])).toEqual([])
    expect(m.telemetry.metricas).toHaveLength(0)
  })

  it("retorno já respondido é toque_invalido e nada é gravado", async () => {
    const m = await montar()
    await m.stores.outcomes.responder(CONTA, m.retornoId, "ajudou", "toque")
    expect(await erroDe(trocar(m, "canela", "nao_gosto"))).toMatchObject({ code: "toque_invalido" })
    expect(await m.stores.preferences.ler(CONTA, [{ tipo: "alimento", id: "canela" }])).toEqual([])
  })

  it("span e métricas não carregam nome de alimento nem texto", async () => {
    const m = await montar()
    await emCasa(m, ["cravo"])
    await trocar(m, "canela", "nao_tenho")
    const span = m.telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "troca", motivo: "nao_tenho", resultado: "trocou" })
    const tudo = JSON.stringify([m.telemetry.spans, m.telemetry.metricas, m.telemetry.logs])
    expect(tudo).not.toMatch(/canela|cravo|gengibre|Chá/i)
  })
})

describe("responderTroca", () => {
  const responder = (m: Montagem, candidato: string, resposta: "tenho" | "nao_tenho") =>
    responderTroca(m.deps, CONTA, {
      runId: m.runId,
      sugestao: 0,
      alimento_id: "canela",
      candidato,
      resposta,
    })

  async function perguntado(m: Montagem): Promise<string> {
    const r = await trocar(m, "canela")
    if (r.resultado !== "perguntar") throw new Error("deveria perguntar")
    return r.pergunta.alimento_id
  }

  it("tenho registra em casa com origem pergunta e troca", async () => {
    const m = await montar()
    const id = await perguntado(m)
    const r = await responder(m, id, "tenho")
    expect(r.resultado).toBe("trocou")
    const item = (await m.stores.pantry.listar(CONTA)).find((i) => i.alimento_id === id)
    expect(item).toMatchObject({ estado: "tem", origem: "pergunta" })
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca?.alimento_id).toBe(id)
    expect(metricas(m, "ritu_troca_ingrediente_total").at(-1)?.rotulos).toEqual({
      resultado: "trocou",
    })
  })

  it("nao_tenho marca acabou, grava a falta e devolve sem_substituto", async () => {
    const m = await montar()
    const id = await perguntado(m)
    await m.stores.pantry.registrar(CONTA, [{ alimento_id: id }], "tela")
    const r = await responder(m, id, "nao_tenho")
    expect(r).toEqual({
      resultado: "sem_substituto",
      texto: "Não achei uma troca para canela com o que você tem em casa.",
    })
    expect((await m.stores.pantry.listar(CONTA)).find((i) => i.alimento_id === id)?.estado).toBe(
      "acabou",
    )
    expect(await m.stores.shortages.diasComFalta(CONTA, DIA)).toEqual([
      { alimento_id: id, dias: 1, ultimo_dia: DIA },
    ])
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca).toBeUndefined()
    expect(metricas(m, "ritu_faltas_total")).toMatchObject([{ rotulos: { origem: "nao_tenho" } }])
  })

  it("candidato que virou nao_gosto entre a pergunta e a resposta é sem_substituto", async () => {
    const m = await montar()
    const id = await perguntado(m)
    await m.stores.preferences.definirGosto(CONTA, { tipo: "alimento", id }, "nao_gosta")
    const r = await responder(m, id, "tenho")
    expect(r.resultado).toBe("sem_substituto")
    expect(await m.stores.pantry.listar(CONTA)).toEqual([])
    expect((await saidaDoRun(m)).sugestoes[0]?.itens[1]?.troca).toBeUndefined()
  })

  it("candidato que não sai da lista é sem_substituto", async () => {
    const m = await montar()
    const r = await responder(m, "mamao", "tenho")
    expect(r.resultado).toBe("sem_substituto")
    expect(await m.stores.pantry.listar(CONTA)).toEqual([])
  })

  it("outra conta ou retorno respondido é toque_invalido", async () => {
    const m = await montar()
    const id = await perguntado(m)
    expect(
      await erroDe(
        responderTroca(m.deps, "outra", {
          runId: m.runId,
          sugestao: 0,
          alimento_id: "canela",
          candidato: id,
          resposta: "tenho",
        }),
      ),
    ).toMatchObject({ code: "toque_invalido" })
    await m.stores.outcomes.responder(CONTA, m.retornoId, "ajudou", "toque")
    expect(await erroDe(responder(m, id, "tenho"))).toMatchObject({ code: "toque_invalido" })
    expect(await m.stores.pantry.listar(CONTA)).toEqual([])
  })
})
