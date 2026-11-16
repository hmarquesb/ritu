import { describe, expect, it } from "vitest"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import {
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Autorização do bloco: só a conta dona do run aprova ou lê as linhas, e uma aprovação vale uma vez.
// Cenário: a casa do "casa-sozinha", com o bloco aberto (uma linha de abóbora, couve e pitaia).

function base(): CenarioDeConversa {
  const c = cenariosDeConversa["casa-sozinha"]
  if (!c) throw new Error("cenário casa-sozinha ausente")
  return { ...c, aprovacao: undefined }
}

async function abrirBloco() {
  const c = base()
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  const runId = rodada.final.run_id
  const ids = rodada.final.saida?.propostas.map((p) => p.id) ?? []
  return { contaId, deps, runId, ids }
}

// Sem ids gerados (uuid muda de um ambiente para outro, inclusive conta_id): só o que foi gravado.
async function fotografar(deps: DepsDoCenario, contaId: string) {
  const casa = await deps.stores.pantry.listar(contaId)
  const lista = await deps.stores.shortages.lista(contaId)
  const rotina = await deps.stores.routine.notasAtivas(contaId)
  const { conta_id: _conta, ...perfil } = await deps.stores.profiles.ler(contaId)
  return {
    perfil,
    casa: casa.map((i) => ({
      alimento_id: i.alimento_id,
      nome_livre: i.nome_livre,
      estado: i.estado,
    })),
    rotina: rotina.map((n) => n.texto),
    lista: lista.map((l) => ({ alimento_id: l.alimento_id, motivo: l.motivo, detalhe: l.detalhe })),
  }
}

describe("autorização: outra conta", () => {
  it("controle: a conta dona aprova o bloco", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco()

    const r = await deps.conversation.aprovar(contaId, runId, ids)

    expect(r.status).toBe("done")
    expect(r.gravadas).toHaveLength(ids.length)
  })

  it.each([
    ["com as linhas", (ids: string[]) => ids],
    ["sem linha nenhuma", () => []],
  ])("outra conta não aprova %s: RunNaoContinuavelError e nada muda", async (_nome, escolher) => {
    const { contaId, deps, runId, ids } = await abrirBloco()
    const antes = await fotografar(deps, contaId)
    const outra = await deps.stores.accounts.criar({ tipo: "demo" })

    await expect(deps.conversation.aprovar(outra.id, runId, escolher(ids))).rejects.toBeInstanceOf(
      RunNaoContinuavelError,
    )

    expect(await fotografar(deps, contaId)).toEqual(antes)
    expect((await deps.stores.runs.buscar(contaId, runId))?.status).toBe("waiting_for_approval")
    expect(await deps.stores.pantry.listar(outra.id)).toEqual([])
    expect(await deps.stores.routine.notasAtivas(outra.id)).toEqual([])
    expect(await deps.stores.shortages.lista(outra.id)).toEqual([])
  })

  it("outra conta não lê as linhas do bloco", async () => {
    const { contaId, deps, runId } = await abrirBloco()
    const outra = await deps.stores.accounts.criar({ tipo: "demo" })

    expect(await deps.stores.proposals.doRun(outra.id, runId)).toEqual([])
    expect((await deps.stores.proposals.doRun(contaId, runId)).length).toBeGreaterThan(0)
  })
})

describe("autorização: uma aprovação vale uma vez", () => {
  it("aprovar duas vezes em seguida: a segunda não grava nada", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco()
    await deps.conversation.aprovar(contaId, runId, ids)
    const depois = await fotografar(deps, contaId)

    await expect(deps.conversation.aprovar(contaId, runId, ids)).rejects.toBeInstanceOf(
      RunNaoContinuavelError,
    )

    expect(await fotografar(deps, contaId)).toEqual(depois)
    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.filter((e) => e.tipo === "aprovacao")).toHaveLength(1)
  })

  it("aprovar ao mesmo tempo: só uma das duas grava", async () => {
    const { contaId, deps, runId, ids } = await abrirBloco()
    // Controle: o estado de uma aprovação só, em outro ambiente com o mesmo cenário.
    const referencia = await abrirBloco()
    await referencia.deps.conversation.aprovar(referencia.contaId, referencia.runId, referencia.ids)
    const esperado = await fotografar(referencia.deps, referencia.contaId)

    const [primeira, segunda] = await Promise.allSettled([
      deps.conversation.aprovar(contaId, runId, ids),
      deps.conversation.aprovar(contaId, runId, ids),
    ])

    const resultados = [primeira, segunda]
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const perdedora = resultados.find((r) => r.status === "rejected")
    expect(perdedora?.status === "rejected" && perdedora.reason).toBeInstanceOf(
      RunNaoContinuavelError,
    )
    expect(await fotografar(deps, contaId)).toEqual(esperado)
    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.filter((e) => e.tipo === "aprovacao")).toHaveLength(1)
  })
})
