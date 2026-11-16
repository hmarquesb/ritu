import { describe, expect, it, vi } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import { getContainer } from "@/infra/container"
import {
  cenariosComAprovacao,
  cenariosDeMemoria,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"

// Aprovação com rotina: a nota gravada atualiza o resumo, a falha do resumo não derruba a aprovação, e a Memória só roda com linha de rotina.
const kb = getContainer().knowledge
const FATO = "você voltou a almoçar em casa todo dia"

// O contexto da segunda mensagem: o preparo lê o resumo novo (um run sem pausa não guarda o preparo no checkpoint).
function preparoDaSegunda(deps: DepsDoCenario, contaId: string) {
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    { intencoes: ["momento"], estados: [], evitar_da_mensagem: [] },
  )
}

describe("aprovar a nota de rotina", () => {
  it("atualiza o resumo (versão 2) e o preparo seguinte já usa o resumo novo", async () => {
    const c = cenariosDeMemoria["rotina-resumida"]
    if (!c) throw new Error("cenário rotina-resumida ausente")
    const { contaId, deps } = await montarCenario(c)
    const memoria = vi.spyOn(deps.memory, "resumir")

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["memoria.propor"])
    expect(memoria).toHaveBeenCalledTimes(1)
    const resumo = await deps.stores.routine.resumo(contaId)
    expect(resumo).toMatchObject({
      versao: 2,
      texto: "Você voltou a almoçar em casa todo dia. Você acorda às 5 h às terças.",
    })
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.resumo_de_rotina).toBe(resumo?.texto)
  })

  it("se o resumo falha, a nota fica gravada, a aprovação termina em done e a etapa erro resumo_de_rotina aparece", async () => {
    const c = cenariosDeMemoria["rotina-resumida"]
    if (!c) throw new Error("cenário rotina-resumida ausente")
    const { contaId, deps } = await montarCenario(c)
    vi.spyOn(deps.memory, "resumir").mockRejectedValue(new Error("falha de teste"))

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.resultado.status).toBe("done")
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["memoria.propor"])
    const ativas = await deps.stores.routine.notasAtivas(contaId)
    expect(ativas).toHaveLength(3)
    expect(ativas).toContainEqual(expect.objectContaining({ texto: FATO }))
    expect((await deps.stores.routine.resumo(contaId))?.versao).toBe(1)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    const erros = etapas.filter((e) => e.tipo === "erro" && e.nome === "resumo_de_rotina")
    expect(erros).toHaveLength(1)
    expect(erros[0]).toMatchObject({ status: "falhou", resumo: null })
  })

  it("aprovar outra linha, sem a da rotina, não chama a Memória e não grava resumo", async () => {
    const c = cenariosComAprovacao["aprovacao-parcial"]
    if (!c) throw new Error("cenário aprovacao-parcial ausente")
    const { contaId, deps } = await montarCenario(c)
    const memoria = vi.spyOn(deps.memory, "resumir")

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["casa.propor"])
    expect(memoria).not.toHaveBeenCalled()
    expect(await deps.stores.routine.resumo(contaId)).toBeUndefined()
    expect(await deps.stores.routine.notasAtivas(contaId)).toEqual([])
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    expect(etapas.filter((e) => e.tipo === "memoria")).toEqual([])
  })
})
