import { clima } from "@config/clima"
import type { Clock } from "@/core/clock"
import type { Clima, Coordenadas, WeatherSource } from "./ports"

type Entrada = { clima: Clima; em: number }

function chaveDe(c: Coordenadas): string {
  return `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`
}

// Decorador em memória: uma instância por processo. Falha não é guardada; pedidos simultâneos compartilham a mesma promessa.
export function createCachedWeatherSource(dentro: WeatherSource, clock: Clock): WeatherSource {
  const guardados = new Map<string, Entrada>()
  const emVoo = new Map<string, Promise<Clima>>()
  const validadeMs = clima.cacheMinutos * 60_000

  function estaValido(entrada: Entrada | undefined): entrada is Entrada {
    return entrada !== undefined && clock.now().getTime() - entrada.em < validadeMs
  }

  function pedirADentro(chave: string, c: Coordenadas): Promise<Clima> {
    const pedido = dentro.buscar(c).then(
      (resultado) => {
        guardados.set(chave, { clima: resultado, em: clock.now().getTime() })
        emVoo.delete(chave)
        return resultado
      },
      (erro: unknown) => {
        emVoo.delete(chave)
        throw erro
      },
    )
    emVoo.set(chave, pedido)
    return pedido
  }

  return {
    buscar(c) {
      const chave = chaveDe(c)
      const entrada = guardados.get(chave)
      if (estaValido(entrada)) return Promise.resolve(entrada.clima)
      return emVoo.get(chave) ?? pedirADentro(chave, c)
    },
  }
}
