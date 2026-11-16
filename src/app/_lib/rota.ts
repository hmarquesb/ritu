import type { z } from "zod"
import type { Conta } from "@/core/accounts/types"
import { RituError } from "@/core/errors"
import type { Container } from "@/infra/container"

export type DepsDaRota = {
  contaDaSessao(): Promise<string | undefined>
  container: Container
}

type Contexto<B> = { conta: Conta; corpo: B; request: Request; container: Container }

function resposta(status: number, corpo: unknown): Response {
  return Response.json(corpo, { status })
}

type Lido = { ok: true; valor: unknown } | { ok: false; resposta: Response }

async function lerCorpo(request: Request, maximo: number): Promise<Lido> {
  const declarado = Number(request.headers.get("content-length") ?? 0)
  if (declarado > maximo) return { ok: false, resposta: resposta(413, { erro: "corpo_grande" }) }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > maximo) {
    return { ok: false, resposta: resposta(413, { erro: "corpo_grande" }) }
  }
  try {
    return { ok: true, valor: JSON.parse(texto) }
  } catch {
    return { ok: false, resposta: resposta(400, { erro: "corpo_invalido" }) }
  }
}

type Validado<B> = { ok: true; valor: B } | { ok: false; resposta: Response }

async function lerValidado<B>(
  request: Request,
  schema: z.ZodType<B>,
  maximo: number,
): Promise<Validado<B>> {
  const lido = await lerCorpo(request, maximo)
  if (!lido.ok) return lido
  const validado = schema.safeParse(lido.valor)
  if (!validado.success) return { ok: false, resposta: resposta(400, { erro: "corpo_invalido" }) }
  return { ok: true, valor: validado.data }
}

export function criarRota<B, R>(
  deps: DepsDaRota,
  opts: { corpo?: z.ZodType<B> },
  fn: (ctx: Contexto<B>) => Promise<R>,
): (request: Request) => Promise<Response> {
  const { container } = deps
  return async (request) => {
    try {
      const contaId = await deps.contaDaSessao()
      const conta = contaId ? await container.stores.accounts.buscar(contaId) : undefined
      if (!conta) return resposta(401, { erro: "sem_sessao" })
      let corpo = undefined as B
      if (opts.corpo) {
        const lido = await lerValidado(
          request,
          opts.corpo,
          container.config.limites.corpoMaximoBytes,
        )
        if (!lido.ok) return lido.resposta
        corpo = lido.valor
      }
      return resposta(200, await fn({ conta, corpo, request, container }))
    } catch (erro) {
      if (erro instanceof RituError) return resposta(400, { erro: erro.code })
      container.telemetry.log("error", "erro_inesperado")
      return resposta(500, { erro: "erro_inesperado" })
    }
  }
}
