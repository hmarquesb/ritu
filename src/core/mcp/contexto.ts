import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { Prakriti } from "@/core/knowledge/adequacao"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { Telemetry } from "@/core/telemetry/ports"
import type { ToolContext } from "@/core/tools/tool"
import type { CidadeDaPessoa, CityLookup, WeatherSource } from "@/core/weather/ports"

export type DepsPublicas = {
  kb: KnowledgeBase
  clima: WeatherSource
  cidades: CityLookup
  clock: Clock
  telemetry: Telemetry
}

// Tools públicas não têm conta: qualquer acesso a store é um erro de programação, nunca um dado.
export const storesProibidos: ToolContext["stores"] = new Proxy({} as ToolContext["stores"], {
  get() {
    throw new RituError("mcp_sem_conta", "Esta ferramenta não lê dados de conta.")
  },
})

export function contextoPublico(
  deps: DepsPublicas,
  extras?: { prakriti?: Prakriti; cidade?: CidadeDaPessoa },
): ToolContext {
  return {
    kb: deps.kb,
    filtro: filtroVazio,
    sinais: sinaisVazios,
    ...(extras?.prakriti ? { prakriti: extras.prakriti } : {}),
    clima: { fonte: deps.clima, cidade: extras?.cidade },
    contaId: "mcp",
    stores: storesProibidos,
    clock: deps.clock,
    telemetry: deps.telemetry,
    ...(extras?.cidade ? { fuso: extras.cidade.fuso } : {}),
  }
}
