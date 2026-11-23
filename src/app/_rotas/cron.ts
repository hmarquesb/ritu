import { descarregarDepois } from "@/app/_apoio/descarregar"
import { autorizarCron } from "@/app/api/cron/_autorizar"
import { executarLimpeza } from "@/core/cleanup"
import { RituError } from "@/core/errors"
import type { Container } from "@/infra/container"

export type DepsDaRotaDeCron = {
  container: Container
  segredo: () => string | undefined
}

// Resposta de recusa do cron, ou undefined quando o pedido está autorizado.
export function recusaDeCron(
  request: Request,
  segredo: () => string | undefined,
): Response | undefined {
  const autorizacao = autorizarCron(request.headers.get("authorization"), segredo())
  if (autorizacao.ok) return undefined
  return Response.json({ erro: autorizacao.erro }, { status: autorizacao.status })
}

// Depois de responder, envia o que falta da telemetria (no-op com a telemetria nula).
export function comDescarga(
  container: Container,
  executar: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const resposta = await executar(request)
    descarregarDepois(container)
    return resposta
  }
}

export function rotaDaLimpeza(deps: DepsDaRotaDeCron): (request: Request) => Promise<Response> {
  const { container } = deps
  return comDescarga(container, async (request) => {
    const autorizacao = autorizarCron(request.headers.get("authorization"), deps.segredo())
    if (!autorizacao.ok) {
      if (autorizacao.status === 503) {
        return Response.json({ erro: "cron_desligado" }, { status: 503 })
      }
      return Response.json({ erro: "sem_autorizacao" }, { status: 401 })
    }
    try {
      const { stores, clock, ledger, limiter, bastidores, telemetry } = container
      return Response.json(
        await executarLimpeza({ stores, clock, ledger, limiter, bastidores, telemetry }),
      )
    } catch {
      container.telemetry.log("erro_inesperado")
      return Response.json({ erro: "erro_inesperado" }, { status: 500 })
    }
  })
}

export function rotaDosPadroes(deps: DepsDaRotaDeCron): (request: Request) => Promise<Response> {
  const { container } = deps
  return comDescarga(container, async (request) => {
    const recusa = recusaDeCron(request, deps.segredo)
    if (recusa) return recusa
    try {
      return Response.json(await container.patterns.detectarPadroes())
    } catch (e) {
      container.telemetry.log("erro_inesperado", {
        "erro.codigo": e instanceof RituError ? e.code : "desconhecido",
      })
      return Response.json({ erro: "falhou" }, { status: 500 })
    }
  })
}
