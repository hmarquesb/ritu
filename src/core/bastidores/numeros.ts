import { config } from "@config/index"
import type { AgregadosDosRuns, BastidoresStore, SinaisDaSemana } from "@/core/bastidores/ports"
import type { Clock } from "@/core/clock"
import { diaLocal, diasAtras } from "@/core/time/dia-local"

export type Janela = { de: string; ate: string } // AAAA-MM-DD, inclusiva

export type NumerosDaSemana =
  | { tipo: "poucos"; janela: Janela; runs: number; minimo: number }
  | { tipo: "ok"; janela: Janela; runs: AgregadosDosRuns; sinais: SinaisDaSemana }

export type DepsDosNumeros = { store: BastidoresStore; clock: Clock }

type Guardado = { ate: string; valor: NumerosDaSemana; lido_em: number }

// Janela de dias completos: `ate` é ontem no fuso; `de` recua até fechar `dias`.
export function janelaDaSemana(
  agora: Date,
  fuso: string,
  dias: number = config.bastidores.dias,
): Janela {
  const ate = diasAtras(diaLocal(agora, fuso), 1)
  return { de: diasAtras(ate, dias - 1), ate }
}

// O fuso é o padrão (`config.clima.fusoPadrao`), o mesmo da limpeza e dos limites diários.
// Uma instância por container: o cache guarda a última leitura e vale até o `cacheMs` ou a virada do dia.
export function criarNumerosDaSemana(deps: DepsDosNumeros): () => Promise<NumerosDaSemana> {
  const { store, clock } = deps
  const { minimoDeRuns, topTools, toolsFora, cacheMs } = config.bastidores
  let guardado: Guardado | undefined

  async function lerDoBanco(janela: Janela): Promise<NumerosDaSemana> {
    const runs = await store.agregadosDosRuns(janela.de, janela.ate, { topTools, toolsFora })
    if (runs.runs < minimoDeRuns) {
      return { tipo: "poucos", janela, runs: runs.runs, minimo: minimoDeRuns }
    }
    const sinais = await store.sinais(janela.de, janela.ate)
    return { tipo: "ok", janela, runs, sinais }
  }

  return async () => {
    const agora = clock.now()
    const janela = janelaDaSemana(agora, config.clima.fusoPadrao)
    if (
      guardado !== undefined &&
      guardado.ate === janela.ate &&
      agora.getTime() - guardado.lido_em < cacheMs
    ) {
      return guardado.valor
    }
    // Erro do store sobe sem ser guardado: a próxima chamada tenta de novo.
    const valor = await lerDoBanco(janela)
    guardado = { ate: janela.ate, valor, lido_em: agora.getTime() }
    return valor
  }
}
