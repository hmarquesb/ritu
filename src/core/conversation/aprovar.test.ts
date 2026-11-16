import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { type ConteudoDaProposta, semTool } from "@/core/proposals/conteudo"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import { createRunService } from "@/core/runs/run-service"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { criarAprovar } from "./aprovar"

const kb = createMiniKnowledge()
const SEGREDO = "nota-secreta-da-pessoa"

const restricao: ConteudoDaProposta = {
  tool: "memoria.propor",
  tipo: "restricao",
  itens: ["vegetariana"],
}
const casaTem: ConteudoDaProposta = {
  tool: "casa.propor",
  acao: "tem",
  itens: [{ alimento_id: "gengibre", nome: "gengibre" }],
}
const rotina: ConteudoDaProposta = { tool: "memoria.propor", tipo: "rotina", texto: SEGREDO }
const gosta: ConteudoDaProposta = {
  tool: "memoria.propor",
  tipo: "gosta",
  itens: [{ alimento_id: "canela", nome: "canela" }],
}
const lista = (motivo: "faltou_hoje" | "fez_falta"): ConteudoDaProposta => ({
  tool: "lista.propor",
  alimento_id: "limao",
  motivo,
  detalhe: motivo === "fez_falta" ? "3" : "o chá",
})

type Opcoes = { falharNaRotina?: boolean }

async function montar(o: Opcoes = {}) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const runs = createRunService({
    stores,
    tx: stores,
    runtime: createScriptedRuntime([], clock),
    clock,
    telemetry,
  })
  const tx = o.falharNaRotina
    ? {
        emTransacao: <T>(fn: (s: Stores) => Promise<T>) =>
          stores.emTransacao((s) =>
            fn({
              ...s,
              routine: {
                ...s.routine,
                anotar: async () => {
                  throw new Error("falha simulada")
                },
              },
            }),
          ),
      }
    : stores
  const aprovar = criarAprovar({ stores, tx, kb, clock, telemetry, runs })
  const conta = await stores.accounts.criar({ tipo: "demo" })
  return { clock, stores, telemetry, runs, aprovar, conta }
}

type M = Awaited<ReturnType<typeof montar>>

async function abrirBloco(m: M, conteudos: ConteudoDaProposta[]) {
  const run = await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
  const criadas = await m.stores.proposals.criar(m.conta.id, run.id, conteudos.map(semTool))
  await m.runs.pausarSemAgente(m.conta.id, run.id, {
    tipo: "aprovacao",
    conteudo: { propostas: criadas.map((c) => c.id) },
  })
  m.telemetry.metricas.length = 0
  return { run, ids: criadas.map((c) => c.id) }
}

async function estadoDaPessoa(m: M) {
  const id = m.conta.id
  return {
    perfil: await m.stores.profiles.ler(id),
    casa: await m.stores.pantry.listar(id),
    rotina: await m.stores.routine.notasAtivas(id),
    lista: await m.stores.shortages.lista(id),
  }
}

const decisoes = async (m: M, runId: string) =>
  (await m.stores.proposals.doRun(m.conta.id, runId)).map((p) => p.decisao)

describe("aprovar", () => {
  it("aprovação parcial grava só a aprovada, fecha o run e conta por linha", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [restricao, casaTem, rotina])
    const r = await m.aprovar(m.conta.id, run.id, [ids[0] as string])
    expect(r).toMatchObject({ run_id: run.id, status: "done", recusadas: [ids[1], ids[2]] })
    expect(r.gravadas.map((g) => g.id)).toEqual([ids[0]])
    expect(r.gravadas[0]?.texto).toBe("Sua alimentação é vegetariana")
    expect(await decisoes(m, run.id)).toEqual(["aprovada", "recusada", "recusada"])
    const estado = await estadoDaPessoa(m)
    expect(estado.perfil.restricoes).toEqual(["vegetariana"])
    expect(estado.casa).toEqual([])
    expect(estado.rotina).toEqual([])
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
    const etapas = await m.stores.runs.etapas(m.conta.id, run.id)
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("1 de 3")
    const span = m.telemetry.spans.find((s) => s.nome === "aprovacao.execucao")
    expect(span?.atributos).toMatchObject({ "propostas.total": 3, "propostas.aprovadas": 1 })
    const contagem = m.telemetry.metricas.filter((x) => x.nome === "ritu_propostas_total")
    expect(contagem.map((x) => x.rotulos)).toEqual([
      { tool: "memoria.propor", decisao: "aprovada" },
      { tool: "casa.propor", decisao: "recusada" },
      { tool: "memoria.propor", decisao: "recusada" },
    ])
  })

  it("Agora não: tudo recusado, nada gravado, run done", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [restricao, casaTem])
    const antes = await estadoDaPessoa(m)
    const r = await m.aprovar(m.conta.id, run.id, [])
    expect(r.gravadas).toEqual([])
    expect(r.recusadas).toEqual(ids)
    expect(await decisoes(m, run.id)).toEqual(["recusada", "recusada"])
    expect(await estadoDaPessoa(m)).toEqual(antes)
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
  })

  it("ids repetidos contam uma vez", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina])
    const r = await m.aprovar(m.conta.id, run.id, [ids[0] as string, ids[0] as string])
    expect(r.gravadas).toHaveLength(1)
    expect(await m.stores.routine.notasAtivas(m.conta.id)).toHaveLength(1)
  })

  it("30 min exatos ainda valem; 30 min e 1 ms expiram", async () => {
    const exato = await montar()
    const a = await abrirBloco(exato, [rotina])
    exato.clock.advance(30 * 60_000)
    await expect(exato.aprovar(exato.conta.id, a.run.id, a.ids)).resolves.toMatchObject({
      status: "done",
    })

    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina, lista("fez_falta")])
    m.clock.advance(30 * 60_000 + 1)
    await expect(m.aprovar(m.conta.id, run.id, ids)).rejects.toMatchObject({
      code: "aprovacao_expirada",
    })
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("expired")
    expect(await decisoes(m, run.id)).toEqual(["expirada", "expirada"])
    expect((await estadoDaPessoa(m)).rotina).toEqual([])
    expect(await m.stores.proposals.recusadas(m.conta.id, "lista.propor")).toEqual([])
  })

  it("lista recusada aparece em recusadas", async () => {
    const m = await montar()
    const { run } = await abrirBloco(m, [lista("fez_falta")])
    await m.aprovar(m.conta.id, run.id, [])
    expect(await m.stores.proposals.recusadas(m.conta.id, "lista.propor")).toHaveLength(1)
  })

  it("id fora do run é aprovacao_invalida e nada muda", async () => {
    const m = await montar()
    const { run } = await abrirBloco(m, [rotina])
    const erro = await m.aprovar(m.conta.id, run.id, ["id-que-nao-e-do-run"]).catch((e) => e)
    expect(erro).toBeInstanceOf(RituError)
    expect(erro.code).toBe("aprovacao_invalida")
    expect(await decisoes(m, run.id)).toEqual(["pendente"])
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("waiting_for_approval")
  })

  it("outra conta, run done ou run expired: RunNaoContinuavelError", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina])
    const outra = await m.stores.accounts.criar({ tipo: "demo" })
    await expect(m.aprovar(outra.id, run.id, ids)).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect(await decisoes(m, run.id)).toEqual(["pendente"])

    await m.stores.runs.atualizar(m.conta.id, run.id, { status: "done" })
    await expect(m.aprovar(m.conta.id, run.id, ids)).rejects.toBeInstanceOf(RunNaoContinuavelError)
    await m.stores.runs.atualizar(m.conta.id, run.id, { status: "expired" })
    await expect(m.aprovar(m.conta.id, run.id, ids)).rejects.toBeInstanceOf(RunNaoContinuavelError)
  })

  it("duas chamadas em seguida: a segunda lança e nada é gravado de novo", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina])
    await m.aprovar(m.conta.id, run.id, ids)
    await expect(m.aprovar(m.conta.id, run.id, ids)).rejects.toBeInstanceOf(RunNaoContinuavelError)
    expect(await m.stores.routine.notasAtivas(m.conta.id)).toHaveLength(1)
  })

  it("duas ao mesmo tempo: uma grava, a outra lança", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina])
    const r = await Promise.allSettled([
      m.aprovar(m.conta.id, run.id, ids),
      m.aprovar(m.conta.id, run.id, ids),
    ])
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1)
    const falha = r.find((x) => x.status === "rejected")
    expect(falha).toMatchObject({ reason: expect.any(RunNaoContinuavelError) })
    expect(await m.stores.routine.notasAtivas(m.conta.id)).toHaveLength(1)
  })

  it("conteúdo que o executor não aceita fica recusado com a etapa proposta_invalida", async () => {
    const m = await montar()
    const foraDaBase: ConteudoDaProposta = {
      tool: "casa.propor",
      acao: "tem",
      itens: [{ alimento_id: "fora-da-base", nome: "x" }],
    }
    const { run, ids } = await abrirBloco(m, [foraDaBase, restricao])
    const r = await m.aprovar(m.conta.id, run.id, ids)
    expect(r.recusadas).toEqual([ids[0]])
    expect(r.gravadas.map((g) => g.id)).toEqual([ids[1]])
    expect(await decisoes(m, run.id)).toEqual(["recusada", "aprovada"])
    const etapas = await m.stores.runs.etapas(m.conta.id, run.id)
    expect(etapas.find((e) => e.nome === "proposta_invalida")).toMatchObject({
      tipo: "erro",
      status: "falhou",
    })
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("1 de 2")
    expect((await estadoDaPessoa(m)).perfil.restricoes).toEqual(["vegetariana"])
  })

  it("falha no meio desfaz tudo, mantém o run aberto e não soma métrica", async () => {
    const m = await montar({ falharNaRotina: true })
    const { run, ids } = await abrirBloco(m, [restricao, rotina])
    await expect(m.aprovar(m.conta.id, run.id, ids)).rejects.toThrow("falha simulada")
    expect((await estadoDaPessoa(m)).perfil.restricoes).toEqual([])
    expect(await decisoes(m, run.id)).toEqual(["pendente", "pendente"])
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("waiting_for_approval")
    expect(m.telemetry.metricas).toEqual([])
  })

  it("vale ter em casa: fez_falta soma ritu_para_ter_total aprovada e recusada; gosta soma ritu_gosto_total", async () => {
    const m = await montar()
    const a = await abrirBloco(m, [lista("fez_falta"), gosta])
    await m.aprovar(m.conta.id, a.run.id, a.ids)
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_para_ter_total")).toEqual([
      expect.objectContaining({ valor: 1, rotulos: { etapa: "aprovada" } }),
    ])
    expect(m.telemetry.metricas.filter((x) => x.nome === "ritu_gosto_total")).toEqual([
      expect.objectContaining({ valor: 1, rotulos: { gosto: "gosta" } }),
    ])
    expect((await m.stores.shortages.lista(m.conta.id)).map((x) => x.alimento_id)).toEqual([
      "limao",
    ])

    const b = await montar()
    const r = await abrirBloco(b, [lista("fez_falta"), lista("faltou_hoje")])
    await b.aprovar(b.conta.id, r.run.id, [])
    expect(b.telemetry.metricas.filter((x) => x.nome === "ritu_para_ter_total")).toEqual([
      expect.objectContaining({ valor: 1, rotulos: { etapa: "recusada" } }),
    ])
  })

  it("mensagem nova com bloco aberto: run antigo done e propostas expiradas", async () => {
    const m = await montar()
    const { run } = await abrirBloco(m, [rotina])
    await m.runs.iniciarRun(m.conta.id, { caminho: "acompanhante", intencoes: [] })
    expect((await m.stores.runs.buscar(m.conta.id, run.id))?.status).toBe("done")
    expect(await decisoes(m, run.id)).toEqual(["expirada"])
  })

  it("nenhum span, métrica ou log leva o texto da pessoa ou nome de alimento", async () => {
    const m = await montar()
    const { run, ids } = await abrirBloco(m, [rotina, casaTem, gosta])
    await m.aprovar(m.conta.id, run.id, ids)
    const tudo = JSON.stringify([m.telemetry.spans, m.telemetry.metricas, m.telemetry.logs])
    expect(tudo).not.toContain(SEGREDO)
    expect(tudo).not.toContain("gengibre")
    expect(tudo).not.toContain("canela")
  })
})
