import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { apagarPadrao, decidirPadrao } from "./decidir"

const AGORA = "2026-06-03T20:00:00Z"
const PROPOSTA = {
  tipo: "ajuda_em_estado" as const,
  chave: "com_frio+agitada|pratica:cha-gengibre",
  frase: "Quando você está com frio e agitada, chá de gengibre costuma te ajudar.",
  ocorrencias: 3,
}

function setup() {
  const clock = createFixedClock(AGORA)
  const stores: Stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  return { stores, telemetry }
}

async function candidato(stores: Stores, contaId: string, chave = PROPOSTA.chave) {
  const padrao = await stores.patterns.propor(contaId, { ...PROPOSTA, chave })
  if (!padrao) throw new Error("semeadura falhou")
  return padrao
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (e) {
    return e
  }
  return undefined
}

describe("decidirPadrao", () => {
  it("confirma um candidato e soma a métrica com o tipo", async () => {
    const { stores, telemetry } = setup()
    const padrao = await candidato(stores, "conta-a")

    await decidirPadrao({ stores, telemetry }, "conta-a", padrao.id, "confirmado")

    const [atual] = await stores.patterns.listar("conta-a")
    expect(atual?.status).toBe("confirmado")
    expect(telemetry.metricas).toEqual([
      expect.objectContaining({
        nome: "ritu_padroes_total",
        rotulos: { tipo: "ajuda_em_estado", etapa: "confirmado" },
      }),
    ])
  })

  it("recusa um candidato e soma a métrica com o tipo", async () => {
    const { stores, telemetry } = setup()
    const padrao = await candidato(stores, "conta-a")

    await decidirPadrao({ stores, telemetry }, "conta-a", padrao.id, "recusado")

    const [atual] = await stores.patterns.listar("conta-a")
    expect(atual?.status).toBe("recusado")
    expect(telemetry.metricas).toEqual([
      expect.objectContaining({
        nome: "ritu_padroes_total",
        rotulos: { tipo: "ajuda_em_estado", etapa: "recusado" },
      }),
    ])
  })

  it("padrão de outra conta devolve padrao_invalido e não muda nada", async () => {
    const { stores, telemetry } = setup()
    const padrao = await candidato(stores, "conta-a")

    const erro = await erroDe(
      decidirPadrao({ stores, telemetry }, "conta-b", padrao.id, "confirmado"),
    )

    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("padrao_invalido")
    expect((await stores.patterns.listar("conta-a"))[0]?.status).toBe("candidato")
    expect(telemetry.metricas).toEqual([])
  })

  it("padrão já confirmado devolve padrao_invalido", async () => {
    const { stores, telemetry } = setup()
    const padrao = await candidato(stores, "conta-a")
    await stores.patterns.decidir("conta-a", padrao.id, "confirmado")

    const erro = await erroDe(
      decidirPadrao({ stores, telemetry }, "conta-a", padrao.id, "recusado"),
    )

    expect((erro as RituError).code).toBe("padrao_invalido")
    expect((await stores.patterns.listar("conta-a"))[0]?.status).toBe("confirmado")
    expect(telemetry.metricas).toEqual([])
  })

  it("padrão já recusado devolve padrao_invalido", async () => {
    const { stores, telemetry } = setup()
    const padrao = await candidato(stores, "conta-a")
    await stores.patterns.decidir("conta-a", padrao.id, "recusado")

    const erro = await erroDe(
      decidirPadrao({ stores, telemetry }, "conta-a", padrao.id, "confirmado"),
    )

    expect((erro as RituError).code).toBe("padrao_invalido")
    expect((await stores.patterns.listar("conta-a"))[0]?.status).toBe("recusado")
    expect(telemetry.metricas).toEqual([])
  })

  it("id inexistente devolve padrao_invalido", async () => {
    const { stores, telemetry } = setup()

    const erro = await erroDe(
      decidirPadrao({ stores, telemetry }, "conta-a", "nao-existe", "confirmado"),
    )

    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("padrao_invalido")
    expect(telemetry.metricas).toEqual([])
  })
})

describe("apagarPadrao", () => {
  it("apaga um padrão da conta", async () => {
    const { stores } = setup()
    const padrao = await candidato(stores, "conta-a")
    await stores.patterns.decidir("conta-a", padrao.id, "confirmado")

    await apagarPadrao({ stores }, "conta-a", padrao.id)

    expect(await stores.patterns.listar("conta-a")).toEqual([])
  })

  it("padrão de outra conta devolve padrao_invalido e não apaga", async () => {
    const { stores } = setup()
    const padrao = await candidato(stores, "conta-a")

    const erro = await erroDe(apagarPadrao({ stores }, "conta-b", padrao.id))

    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("padrao_invalido")
    expect(await stores.patterns.listar("conta-a")).toHaveLength(1)
  })

  it("id inexistente devolve padrao_invalido", async () => {
    const { stores } = setup()

    const erro = await erroDe(apagarPadrao({ stores }, "conta-a", "nao-existe"))

    expect((erro as RituError).code).toBe("padrao_invalido")
  })
})
