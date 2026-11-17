import type { FraseDeEtapa } from "./etapas"
import type { VisaoDoRun } from "./visao"

export type EventoDaTela =
  | { tipo: "inicio"; run_id: string }
  | { tipo: "etapa"; frase: FraseDeEtapa }
  | { tipo: "fim"; visao: VisaoDoRun; pendentes: number }
  | { tipo: "erro"; erro: string }

const TIPOS_CONHECIDOS = new Set<string>(["inicio", "etapa", "fim", "erro"])

export function codificarEvento(e: EventoDaTela): string {
  return `${JSON.stringify(e)}\n`
}

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
