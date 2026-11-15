import { describe, expect, it } from "vitest"
import { cenarios, montarCenario } from "./index"

const origens: Record<string, "agente" | "sem_modelo"> = {
  "frio-agitada": "agente",
  "pergunta-manga": "agente",
  autocorrecao: "agente",
  "estomago-pesado": "agente",
  "sem-modelo": "sem_modelo",
}

describe("cenários de demonstração", () => {
  it.each(Object.keys(cenarios))("%s termina em done com a origem esperada", async (nome) => {
    const c = cenarios[nome]
    if (!c) throw new Error(`cenário ausente: ${nome}`)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida.origem).toBe(origens[nome])
  })

  it("frio-agitada com o principal de decisao esgotado troca de modelo e termina em done", async () => {
    const c = cenarios["frio-agitada"]
    if (!c) throw new Error("cenário ausente: frio-agitada")
    const { contaId, deps } = await montarCenario(c, { esgotar: "decisao" })
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida.origem).toBe("agente")
    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(run?.trocas_de_modelo).toBeGreaterThanOrEqual(1)
  })

  it("autocorrecao tem duas etapas de validação: recusada e depois ok", async () => {
    const c = cenarios.autocorrecao
    if (!c) throw new Error("cenário ausente: autocorrecao")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const validacoes = etapas.filter((e) => e.tipo === "validacao")
    expect(validacoes.map((e) => e.status)).toEqual(["recusado", "ok"])
  })
})
