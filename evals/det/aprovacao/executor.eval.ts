import { describe, expect, it } from "vitest"
import { criarAprovar } from "@/core/conversation/aprovar"
import { type ConteudoDaProposta, semTool } from "@/core/proposals/conteudo"
import { executarProposta } from "@/core/proposals/executor"
import { createRunService } from "@/core/runs/run-service"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"

// Executor com a base real: cada tipo de proposta aprovada grava o que deve, e o que não passa não grava.
const kb = getContainer().knowledge
const AGORA = "2026-06-15T22:00:00.000Z"
const DIA = "2026-06-15"

async function montar() {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const runs = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime([], clock),
    clock,
    telemetry,
  })
  const aprovar = criarAprovar({ stores, tx: stores, kb, clock, telemetry, runs })
  return { clock, stores, telemetry, conta, runs, aprovar }
}

type M = Awaited<ReturnType<typeof montar>>

// Grava pelo executor, como o aprovar faz com cada linha escolhida.
async function gravar(m: M, c: ConteudoDaProposta): Promise<boolean> {
  const { tool, conteudo } = semTool(c)
  return executarProposta(m.stores, m.conta.id, tool, conteudo, kb)
}

// Estado que o executor pode mexer: se uma proposta recusada muda algo, este estado muda.
async function estado(m: M) {
  const id = m.conta.id
  return {
    perfil: await m.stores.profiles.ler(id),
    casa: await m.stores.pantry.listar(id),
    rotina: await m.stores.routine.notasAtivas(id),
    lista: await m.stores.shortages.lista(id),
    faltas: await m.stores.shortages.diasComFalta(id, "0000-01-01"),
  }
}

describe("executor: cada tipo grava o que foi aprovado", () => {
  it("casa tem registra o item como tem", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "casa.propor",
      acao: "tem",
      itens: [{ alimento_id: "gengibre", nome: "gengibre" }],
    })

    expect(ok).toBe(true)
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.find((i) => i.alimento_id === "gengibre")?.estado).toBe("tem")
  })

  it("casa acabou marca o item como acabou", async () => {
    const m = await montar()
    await gravar(m, {
      tool: "casa.propor",
      acao: "tem",
      itens: [{ alimento_id: "gengibre", nome: "gengibre" }],
    })

    const ok = await gravar(m, {
      tool: "casa.propor",
      acao: "acabou",
      itens: [{ alimento_id: "gengibre", nome: "gengibre" }],
    })

    expect(ok).toBe(true)
    const casa = await m.stores.pantry.listar(m.conta.id)
    expect(casa.find((i) => i.alimento_id === "gengibre")?.estado).toBe("acabou")
  })

  it("evitar sempre entra no perfil", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "memoria.propor",
      tipo: "evitar_sempre",
      itens: [{ tipo: "alimento", valor: "leite" }],
    })

    expect(ok).toBe(true)
    const perfil = await m.stores.profiles.ler(m.conta.id)
    expect(perfil.evitar_sempre).toContainEqual(
      expect.objectContaining({ tipo: "alimento", valor: "leite" }),
    )
  })

  it("restrição entra no perfil", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "memoria.propor",
      tipo: "restricao",
      itens: ["vegetariana"],
    })

    expect(ok).toBe(true)
    expect((await m.stores.profiles.ler(m.conta.id)).restricoes).toEqual(["vegetariana"])
  })

  it("não como entra no perfil como alimento da base", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "memoria.propor",
      tipo: "nao_come",
      itens: [{ alimento_id: "leite", nome: "leite" }],
    })

    expect(ok).toBe(true)
    expect((await m.stores.profiles.ler(m.conta.id)).nao_come).toEqual([
      { tipo: "alimento", valor: "leite" },
    ])
  })

  it("gosta grava a preferência do alimento", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "memoria.propor",
      tipo: "gosta",
      itens: [{ alimento_id: "canela", nome: "canela" }],
    })

    expect(ok).toBe(true)
    const [pref] = await m.stores.preferences.ler(m.conta.id, [{ tipo: "alimento", id: "canela" }])
    expect(pref?.gosto).toBe("gosta")
  })

  it("rotina entra nas notas de rotina ativas", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "memoria.propor",
      tipo: "rotina",
      texto: "essa semana almoço fora",
    })

    expect(ok).toBe(true)
    expect(await m.stores.routine.notasAtivas(m.conta.id)).toContainEqual(
      expect.objectContaining({ texto: "essa semana almoço fora" }),
    )
  })

  it("lista entra na lista de faltas com motivo e detalhe", async () => {
    const m = await montar()

    const ok = await gravar(m, {
      tool: "lista.propor",
      alimento_id: "limao",
      motivo: "faltou_hoje",
      detalhe: "o chá",
    })

    expect(ok).toBe(true)
    expect(await m.stores.shortages.lista(m.conta.id)).toContainEqual(
      expect.objectContaining({ alimento_id: "limao", motivo: "faltou_hoje", detalhe: "o chá" }),
    )
  })
})

describe("executor: registrar em casa apaga as faltas e tira da lista", () => {
  it("casa tem gengibre apaga a falta e tira o gengibre da lista", async () => {
    const m = await montar()
    await m.stores.shortages.registrar(
      m.conta.id,
      [{ alimento_id: "gengibre", origem: "nao_tenho" }],
      DIA,
    )
    await m.stores.shortages.porNaLista(m.conta.id, {
      alimento_id: "gengibre",
      motivo: "faltou_hoje",
      detalhe: "o chá",
    })
    expect((await estado(m)).faltas).toHaveLength(1)

    await gravar(m, {
      tool: "casa.propor",
      acao: "tem",
      itens: [{ alimento_id: "gengibre", nome: "gengibre" }],
    })

    const depois = await estado(m)
    expect(depois.faltas).toEqual([])
    expect(depois.lista.some((l) => l.alimento_id === "gengibre")).toBe(false)
  })
})

describe("executor: o que não passa não grava nada", () => {
  // Conteúdos que chegam com problema: o executor devolve false e o estado fica igual.
  const invalidos: [string, string, unknown][] = [
    ["campo faltando: rotina sem texto", "memoria.propor", { tipo: "rotina" }],
    [
      "remoção: evitar sempre com acao remover",
      "memoria.propor",
      { tipo: "evitar_sempre", acao: "remover", itens: [{ tipo: "alimento", valor: "leite" }] },
    ],
    [
      "remoção: casa com acao remover",
      "casa.propor",
      { acao: "remover", itens: [{ alimento_id: "gengibre", nome: "gengibre" }] },
    ],
    [
      "alimento fora da base no gosta",
      "memoria.propor",
      { tipo: "gosta", itens: [{ alimento_id: "nao-existe-na-base", nome: "x" }] },
    ],
    [
      "alimento fora da base no não como",
      "memoria.propor",
      { tipo: "nao_come", itens: [{ alimento_id: "nao-existe-na-base", nome: "x" }] },
    ],
    [
      "campo a mais: rotina com campo extra",
      "memoria.propor",
      { tipo: "rotina", texto: "almoço fora", extra: "x" },
    ],
    [
      "alimento fora da base na casa",
      "casa.propor",
      { acao: "tem", itens: [{ alimento_id: "nao-existe-na-base", nome: "x" }] },
    ],
  ]

  it.each(invalidos)("%s: não executa", async (_nome, tool, conteudo) => {
    const m = await montar()
    const antes = await estado(m)

    const ok = await executarProposta(m.stores, m.conta.id, tool, conteudo, kb)

    expect(ok).toBe(false)
    expect(await estado(m)).toEqual(antes)
  })

  it.each(invalidos)(
    "%s: passa por aprovar e vira linha recusada com proposta_invalida",
    async (_nome, tool, conteudo) => {
      const m = await montar()
      const run = await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
      const criadas = await m.stores.proposals.criar(m.conta.id, run.id, [{ tool, conteudo }])
      await m.runs.pausarSemAgente(m.conta.id, run.id, {
        tipo: "aprovacao",
        conteudo: { propostas: criadas.map((c) => c.id) },
      })
      const antes = await estado(m)
      const ids = criadas.map((c) => c.id)

      const r = await m.aprovar(m.conta.id, run.id, ids)

      expect(r.gravadas).toEqual([])
      expect(r.recusadas).toEqual(ids)
      expect(await estado(m)).toEqual(antes)
      const doRun = await m.stores.proposals.doRun(m.conta.id, run.id)
      expect(doRun.map((p) => p.decisao)).toEqual(["recusada"])
      const etapas = await m.stores.runs.etapas(m.conta.id, run.id)
      expect(etapas.find((e) => e.nome === "proposta_invalida")).toMatchObject({
        tipo: "erro",
        status: "falhou",
      })
    },
  )
})
