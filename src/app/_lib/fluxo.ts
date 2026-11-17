import { codificarEvento, type EventoDaTela } from "@/core/conversation/eventos"
import type { Container } from "@/infra/container"
import { descarregarDepois } from "../_apoio/descarregar"
import {
  type Contexto,
  type DepsDaRota,
  ehRituError,
  type OpcoesDeRota,
  prepararContexto,
  resposta,
  respostaDeLimite,
  statusDoErro,
} from "./rota"

// Rota de fluxo NDJSON. Os `route.ts` que a usam exportam
// `export const maxDuration = 60` (valor de `telaConversa.rotaMaxDurationS`): o Next
// exige literal estático no segmento, então o número é repetido lá.

export type Emitir = (e: EventoDaTela) => void

type ContextoDeFluxo<B> = Contexto<B>

const CABECALHOS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
}

function descreverErro(erro: unknown, container: Container) {
  if (ehRituError(erro)) return { code: erro.code, status: statusDoErro(erro.code) }
  container.telemetry.log("erro_inesperado")
  return { code: "erro_inesperado", status: 500 }
}

export function criarRotaDeFluxo<B>(
  deps: DepsDaRota,
  opts: OpcoesDeRota<B>,
  fn: (ctx: ContextoDeFluxo<B>, emitir: Emitir) => Promise<void>,
): (request: Request) => Promise<Response> {
  const { container } = deps
  return async (request) => {
    let preparado: Awaited<ReturnType<typeof prepararContexto<B>>>
    try {
      preparado = await prepararContexto(deps, opts, request)
    } catch {
      container.telemetry.log("erro_inesperado")
      return resposta(500, { erro: "erro_inesperado" })
    }
    if (!preparado.ok) return preparado.resposta
    const ctx = preparado.ctx

    return new Promise<Response>((resolver) => {
      const codificador = new TextEncoder()
      let controlador: ReadableStreamDefaultController<Uint8Array> | undefined
      let aberto = false
      let fechado = false
      const fluxo = new ReadableStream<Uint8Array>({
        start(c) {
          controlador = c
        },
        cancel() {
          fechado = true
        },
      })

      const abrir = () => {
        if (aberto) return
        aberto = true
        resolver(new Response(fluxo, { headers: CABECALHOS }))
      }

      const emitir: Emitir = (e) => {
        abrir()
        if (fechado) return
        try {
          controlador?.enqueue(codificador.encode(codificarEvento(e)))
        } catch {
          fechado = true
        }
      }

      const fechar = () => {
        if (fechado) return
        fechado = true
        try {
          controlador?.close()
        } catch {
          // fluxo já encerrado pelo consumidor
        }
      }

      const falhar = (erro: unknown) => {
        const { code, status } = descreverErro(erro, container)
        if (aberto) return emitir({ tipo: "erro", erro: code })
        aberto = true
        resolver(status === 429 ? respostaDeLimite(code, erro) : resposta(status, { erro: code }))
      }

      fn(ctx, emitir)
        .catch(falhar)
        .finally(() => {
          abrir()
          fechar()
          descarregarDepois(container)
        })
    })
  }
}
