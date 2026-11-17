import { timingSafeEqual } from "node:crypto"
import { executarLimpeza } from "@/core/cleanup"
import type { Container } from "@/infra/container"

function autorizado(request: Request, segredo: string): boolean {
  const recebido = Buffer.from(request.headers.get("authorization") ?? "")
  const esperado = Buffer.from(`Bearer ${segredo}`)
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

export function rotaDaLimpeza(deps: {
  container: Container
  segredo: () => string
}): (request: Request) => Promise<Response> {
  const { container } = deps
  return async (request) => {
    const segredo = deps.segredo()
    if (!segredo || !autorizado(request, segredo)) {
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
