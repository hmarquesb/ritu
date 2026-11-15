import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { casaLerTool } from "@/core/agents/tools/memoria"
import { filtroVazio } from "@/core/knowledge/filtros"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { Durabilidade } from "@/core/knowledge/vocab"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const CONTA = "conta-1"
const DIA_EM_MS = 86_400_000
const MINUTO_EM_MS = 60_000
const DESCONHECIDO = "alimento-inexistente"

const kb = createMiniKnowledge()
const idDe = (durabilidade: Durabilidade): string =>
  kb.alimentos.find((a) => a.durabilidade === durabilidade)?.id ?? ""

function ambiente() {
  const clock = createFixedClock("2026-01-15T12:00:00-03:00")
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => id !== DESCONHECIDO })
  const ctx: ToolContext = {
    kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: CONTA,
    stores,
    clock,
  }
  return { ctx, clock, stores }
}

async function estadoDe(ctx: ToolContext, alimentoId: string) {
  const r = await casaLerTool.execute({}, ctx)
  return r.itens.find((i) => i.alimento_id === alimentoId)?.estado
}

describe("estado incerto por durabilidade", () => {
  it.each(["curta", "media", "longa"] as const)(
    "durabilidade %s fica confirmada até o prazo e vira incerta um minuto depois",
    async (durabilidade) => {
      const { ctx, clock, stores } = ambiente()
      const id = idDe(durabilidade)
      expect(kb.alimento(id)?.durabilidade).toBe(durabilidade)
      const validade = config.casa.validadeDias[durabilidade]
      await stores.pantry.registrar(CONTA, [{ alimento_id: id }], "conversa")

      clock.advance(validade * DIA_EM_MS)
      expect(await estadoDe(ctx, id)).toBe("confirmado")

      clock.advance(DIA_EM_MS - MINUTO_EM_MS)
      expect(await estadoDe(ctx, id)).toBe("confirmado")

      clock.advance(MINUTO_EM_MS)
      expect(await estadoDe(ctx, id)).toBe("incerto")
    },
  )

  it("sempre tenho nunca fica incerto, mesmo muito depois", async () => {
    const { ctx, clock, stores } = ambiente()
    const id = idDe("curta")
    await stores.pantry.registrar(CONTA, [{ alimento_id: id }], "conversa")
    const [item] = await stores.pantry.listar(CONTA)
    await stores.pantry.definirSempreTenho(CONTA, item?.id ?? "", true)

    clock.advance(400 * DIA_EM_MS)

    expect(await estadoDe(ctx, id)).toBe("sempre_tenho")
  })
})

describe("alimento desconhecido", () => {
  it("é guardado como nome livre e sai em casa.ler com conhecido false", async () => {
    const { ctx, stores } = ambiente()
    await stores.pantry.registrar(CONTA, [{ alimento_id: DESCONHECIDO }], "conversa")

    const r = await casaLerTool.execute({}, ctx)

    expect(r.itens).toContainEqual(
      expect.objectContaining({
        alimento_id: null,
        nome: DESCONHECIDO,
        conhecido: false,
      }),
    )
  })

  it("usa a durabilidade padrão da casa para dizer quando fica incerto", async () => {
    const { ctx, clock, stores } = ambiente()
    await stores.pantry.registrar(CONTA, [{ alimento_id: DESCONHECIDO }], "conversa")
    const validade = config.casa.validadeDias[config.casa.durabilidadeDesconhecido]

    clock.advance(validade * DIA_EM_MS)
    expect((await casaLerTool.execute({}, ctx)).incertos).toBe(0)

    clock.advance(DIA_EM_MS)
    expect((await casaLerTool.execute({}, ctx)).incertos).toBe(1)
  })
})
