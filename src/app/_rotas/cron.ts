import { autorizarCron } from "@/app/api/cron/_autorizar"
import { executarLimpeza } from "@/core/cleanup"
import type { Container } from "@/infra/container"

export function rotaDaLimpeza(deps: {
  container: Container
  segredo: () => string | undefined
}): (request: Request) => Promise<Response> {
  const { container } = deps
  return async (request) => {
    const autorizacao = autorizarCron(request.headers.get("authorization"), deps.segredo())
    if (!autorizacao.ok) {
      if (autorizacao.status === 503) {
        return Response.json({ erro: "cron_desligado" }, { status: 503 })
      }
      return Response.json({ erro: "sem_autorizacao" }, { status: 401 })
    }
    try {
      const { stores, clock, ledger, limiter } = container
      return Response.json(await executarLimpeza({ stores, clock, ledger, limiter }))
    } catch {
      container.telemetry.log("erro_inesperado")
      return Response.json({ erro: "erro_inesperado" }, { status: 500 })
    }
  }
}
