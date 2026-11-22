import { describe, expect, it } from "vitest"
import { montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { estadosJuntos } from "../../../test/fixtures/cenarios/estados-juntos"
import { faltouHoje } from "../../../test/fixtures/cenarios/faltou-hoje"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// Aviso de incômodo pela fala de saúde (013, P2-T6): vale mesmo sem `incomodo` na interpretação.

function comMensagem(texto: string): Cenario {
  return { ...estadosJuntos, mensagem: { texto, atalhos: [] } }
}

async function avisosDe(texto: string) {
  const c = comMensagem(texto)
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return (rodada.final.saida?.avisos ?? []).filter((a) => a.tipo === "incomodo")
}

describe("aviso de incômodo pela fala de saúde", () => {
  it("falar de cura leva o aviso, sem incômodo na interpretação", async () => {
    expect(await avisosDe("esse chá cura gastrite?")).toHaveLength(1)
  })

  it("'se trata de' não leva o aviso", async () => {
    expect(await avisosDe("do que se trata o kitchari?")).toHaveLength(0)
  })

  it("com pausa e retomada, a saída final leva o aviso uma vez", async () => {
    const c: Cenario = {
      ...faltouHoje,
      mensagem: { texto: "esse chá cura gastrite?", atalhos: [] },
    }
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.perguntas.length).toBeGreaterThan(0)
    const avisos = (rodada.final.saida?.avisos ?? []).filter((a) => a.tipo === "incomodo")
    expect(avisos).toHaveLength(1)
  })
})
