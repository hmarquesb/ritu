import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { cenarios, type DepsDoCenario, montarCenario } from "../../../test/fixtures/cenarios"

// Voto (toque): o contador de feedback só anda quando o voto muda, nunca por conta alheia, e sem id nos rótulos.
const FEEDBACK = "ritu_feedback_total"

// Um run com saída, até done, com o toque de voto ainda por fazer.
async function runComSaida() {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  const { contaId, deps } = await montarCenario(c)
  const r = await deps.companion.responder(contaId, c.entrada)
  if (r.status !== "done" || !r.saida) throw new Error("run sem saída")
  return { contaId, deps, runId: r.run_id }
}

// Votos do contador de feedback, na ordem em que foram somados.
function votos(deps: DepsDoCenario): string[] {
  return deps.telemetry.metricas
    .filter((m) => m.tipo === "contador" && m.nome === FEEDBACK)
    .map((m) => String(m.rotulos.voto))
}

describe("voto (toque) soma no contador de feedback", () => {
  it("voto novo soma up", async () => {
    const { contaId, deps, runId } = await runComSaida()
    await deps.touches.tocarVoto(contaId, runId, "up")
    expect(votos(deps)).toEqual(["up"])
  })

  it("voto mudado soma down", async () => {
    const { contaId, deps, runId } = await runComSaida()
    await deps.touches.tocarVoto(contaId, runId, "up")
    await deps.touches.tocarVoto(contaId, runId, "down")
    expect(votos(deps)).toEqual(["up", "down"])
  })

  it("voto repetido não soma", async () => {
    const { contaId, deps, runId } = await runComSaida()
    await deps.touches.tocarVoto(contaId, runId, "up")
    await deps.touches.tocarVoto(contaId, runId, "up")
    expect(votos(deps)).toEqual(["up"])
  })

  it("run de outra conta é recusado e não soma", async () => {
    const { deps, runId } = await runComSaida()
    const outra = await deps.stores.accounts.criar({ tipo: "demo" })
    const chamada = deps.touches.tocarVoto(outra.id, runId, "up")
    await expect(chamada).rejects.toBeInstanceOf(RituError)
    await expect(chamada).rejects.toMatchObject({ code: "toque_invalido" })
    expect(votos(deps)).toEqual([])
  })

  it("nenhum rótulo leva id da conta nem do run", async () => {
    const { contaId, deps, runId } = await runComSaida()
    await deps.touches.tocarVoto(contaId, runId, "up")
    await deps.touches.tocarVoto(contaId, runId, "down")
    const rotulos = deps.telemetry.metricas.map((m) => JSON.stringify(m.rotulos))
    for (const r of rotulos) {
      expect(r).not.toContain(contaId)
      expect(r).not.toContain(runId)
    }
    for (const m of deps.telemetry.metricas.filter((x) => x.nome === FEEDBACK)) {
      expect(Object.keys(m.rotulos)).toEqual(["voto"])
    }
  })
})
