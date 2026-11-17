import type { EventoDaTela } from "@/core/conversation/eventos"

const TIPOS_CONHECIDOS = new Set<string>(["inicio", "etapa", "fim", "erro"])

function eventoDaLinha(linha: string): EventoDaTela | undefined {
  const texto = linha.trim()
  if (texto === "") return undefined
  let lido: unknown
  try {
    lido = JSON.parse(texto)
  } catch {
    return undefined
  }
  if (typeof lido !== "object" || lido === null || !("tipo" in lido)) return undefined
  if (typeof lido.tipo !== "string" || !TIPOS_CONHECIDOS.has(lido.tipo)) return undefined
  return lido as EventoDaTela
}

export function lerEventos(): TransformStream<Uint8Array, EventoDaTela> {
  const decodificador = new TextDecoder("utf-8")
  let resto = ""

  function emitirLinhas(
    linhas: string[],
    controller: TransformStreamDefaultController<EventoDaTela>,
  ) {
    for (const linha of linhas) {
      const evento = eventoDaLinha(linha)
      if (evento) controller.enqueue(evento)
    }
  }

  return new TransformStream<Uint8Array, EventoDaTela>({
    transform(pedaco, controller) {
      const linhas = (resto + decodificador.decode(pedaco, { stream: true })).split("\n")
      resto = linhas.pop() ?? ""
      emitirLinhas(linhas, controller)
    },
    flush(controller) {
      const ultima = resto + decodificador.decode()
      resto = ""
      emitirLinhas([ultima], controller)
    },
  })
}
