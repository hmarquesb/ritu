import { describe, expect, it } from "vitest"
import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import { type ConteudoDaProposta, lerConteudo } from "@/core/proposals/conteudo"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import {
  cenariosComAprovacao,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Três linhas no bloco: restrição (dita na mensagem), casa (abóbora) e rotina (proposta pelo roteiro).
const base = cenariosComAprovacao["aprovacao-parcial"]
if (!base) throw new Error("cenário aprovacao-parcial ausente")

const SINAIS_SEM_BLOCO: Omit<SaidaDoInterprete, "intencoes" | "itens_casa" | "restricoes"> = {
  estados: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  suspeito: false,
}

const tresLinhas: CenarioDeConversa = {
  ...base,
  aprovacao: undefined,
  depois: undefined,
  interpretacao: {
    ...SINAIS_SEM_BLOCO,
    intencoes: ["vida", "casa"],
    itens_casa: [{ nome: "abóbora", acao: "tem" }],
    restricoes: ["vegetariana"],
    fato_de_rotina: "essa semana você vai almoçar fora todo dia",
  },
}

const MINUTOS_DA_ESPERA = 31

// Abre o bloco de três linhas, sem decidir.
async function abrirTres() {
  const llm = createFakeLlm(tresLinhas.interpretacao ? [tresLinhas.interpretacao] : [])
  const { contaId, deps } = await montarCenario(tresLinhas, { llm })
  const rodada = await rodarCenario(deps, contaId, tresLinhas)
  return { contaId, deps, rodada }
}

async function fotografar(deps: DepsDoCenario, contaId: string) {
  return {
    perfil: await deps.stores.profiles.ler(contaId),
    casa: await deps.stores.pantry.listar(contaId),
    rotina: await deps.stores.routine.notasAtivas(contaId),
    lista: await deps.stores.shortages.lista(contaId),
  }
}

// Id das linhas do bloco, pela própria proposta guardada (tool e conteúdo), não pela posição.
async function linhasDoBloco(deps: DepsDoCenario, contaId: string, runId: string) {
  const doRun = await deps.stores.proposals.doRun(contaId, runId)
  return doRun.map((p) => ({ id: p.id, c: lerConteudo(p.tool, p.conteudo) }))
}

type Linha = Awaited<ReturnType<typeof linhasDoBloco>>[number]
const pelo = (linhas: Linha[], pred: (c: ConteudoDaProposta) => boolean): string => {
  const achada = linhas.find((l) => l.c !== undefined && pred(l.c))
  if (!achada) throw new Error("linha do bloco não encontrada")
  return achada.id
}

const ehRestricao = (c: ConteudoDaProposta) => c.tool === "memoria.propor" && c.tipo === "restricao"
const ehCasa = (c: ConteudoDaProposta) => c.tool === "casa.propor"
const ehRotina = (c: ConteudoDaProposta) => c.tool === "memoria.propor" && c.tipo === "rotina"

const LINHAS = { restricao: ehRestricao, casa: ehCasa, rotina: ehRotina } as const
type Escolhida = keyof typeof LINHAS

describe("aprovação parcial: aprova uma de três", () => {
  it.each(["restricao", "casa", "rotina"] as const)(
    "só a linha %s é gravada; as outras duas ficam recusadas",
    async (escolhida: Escolhida) => {
      const { contaId, deps, rodada } = await abrirTres()
      const runId = rodada.final.run_id
      const antes = await fotografar(deps, contaId)
      const linhas = await linhasDoBloco(deps, contaId, runId)
      const id = pelo(linhas, LINHAS[escolhida])

      const r = await deps.conversation.aprovar(contaId, runId, [id])

      expect(r.gravadas.map((g) => g.id)).toEqual([id])
      expect(r.recusadas).toHaveLength(2)
      const depois = await fotografar(deps, contaId)
      expect(depois.perfil.restricoes).toEqual(
        escolhida === "restricao" ? ["vegetariana"] : antes.perfil.restricoes,
      )
      expect(depois.casa).toHaveLength(antes.casa.length + (escolhida === "casa" ? 1 : 0))
      expect(depois.rotina).toHaveLength(antes.rotina.length + (escolhida === "rotina" ? 1 : 0))
      expect(depois.lista).toEqual(antes.lista)
    },
  )

  it("duas de três: a etapa de aprovação mostra 2 de 3", async () => {
    const { contaId, deps, rodada } = await abrirTres()
    const runId = rodada.final.run_id
    const linhas = await linhasDoBloco(deps, contaId, runId)
    const ids = [pelo(linhas, ehRestricao), pelo(linhas, ehCasa)]

    await deps.conversation.aprovar(contaId, runId, ids)

    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("2 de 3")
  })

  it("uma de três: a etapa de aprovação mostra 1 de 3", async () => {
    const { contaId, deps, rodada } = await abrirTres()
    const runId = rodada.final.run_id
    const linhas = await linhasDoBloco(deps, contaId, runId)

    await deps.conversation.aprovar(contaId, runId, [pelo(linhas, ehCasa)])

    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("1 de 3")
  })
})

describe("aprovação parcial: nenhuma linha escolhida é igual a Agora não", () => {
  it("lista vazia grava o mesmo que Agora não e fecha com 0 de 3", async () => {
    const { contaId, deps, rodada } = await abrirTres()
    const runId = rodada.final.run_id
    const aberto = await fotografar(deps, contaId)

    const r = await deps.conversation.aprovar(contaId, runId, [])

    expect(r).toMatchObject({ run_id: runId, status: "done", gravadas: [] })
    expect(r.recusadas).toHaveLength(3)
    expect(await fotografar(deps, contaId)).toEqual(aberto)
    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("0 de 3")
    expect((await deps.stores.runs.buscar(contaId, runId))?.status).toBe("done")
  })

  it("Agora não pelo cenário fecha igual: mesma contagem de linhas recusadas e mesmo estado", async () => {
    const agora = await montarCenario(
      { ...tresLinhas, aprovacao: "agora_nao" },
      {
        llm: createFakeLlm(tresLinhas.interpretacao ? [tresLinhas.interpretacao] : []),
      },
    )
    const rodada = await rodarCenario(agora.deps, agora.contaId, {
      ...tresLinhas,
      aprovacao: "agora_nao",
    })

    expect(rodada.bloco?.resultado).toMatchObject({ status: "done", gravadas: [] })
    expect(rodada.bloco?.resultado.recusadas).toHaveLength(3)
    const etapas = await agora.deps.stores.runs.etapas(agora.contaId, rodada.final.run_id)
    expect(etapas.find((e) => e.tipo === "aprovacao")?.resumo).toBe("0 de 3")
    const estado = await fotografar(agora.deps, agora.contaId)
    expect(estado.perfil.restricoes).toEqual([])
    expect(estado.rotina).toEqual([])
  })
})

describe("aprovação parcial: contagem de propostas por linha", () => {
  it("ritu_propostas_total sai uma vez por linha, com a decisão de cada uma", async () => {
    const { contaId, deps, rodada } = await abrirTres()
    const runId = rodada.final.run_id
    const linhas = await linhasDoBloco(deps, contaId, runId)
    const inicio = deps.telemetry.metricas.length

    await deps.conversation.aprovar(contaId, runId, [
      pelo(linhas, ehRestricao),
      pelo(linhas, ehCasa),
    ])

    const contagem = deps.telemetry.metricas
      .slice(inicio)
      .filter((m) => m.nome === "ritu_propostas_total")
      .map((m) => `${String(m.rotulos.tool)}:${String(m.rotulos.decisao)}`)
      .sort()
    expect(contagem).toEqual(
      ["casa.propor:aprovada", "memoria.propor:aprovada", "memoria.propor:recusada"].sort(),
    )
  })
})

describe("aprovação parcial: expiração depois de 31 min com linhas escolhidas", () => {
  it("expirado, nenhuma linha é gravada", async () => {
    const { contaId, deps, rodada } = await abrirTres()
    const runId = rodada.final.run_id
    const aberto = await fotografar(deps, contaId)
    const linhas = await linhasDoBloco(deps, contaId, runId)

    deps.clock.advance(MINUTOS_DA_ESPERA * 60_000)
    await expect(
      deps.conversation.aprovar(contaId, runId, [pelo(linhas, ehCasa)]),
    ).rejects.toMatchObject({ code: "aprovacao_expirada" })

    expect(await fotografar(deps, contaId)).toEqual(aberto)
  })
})
