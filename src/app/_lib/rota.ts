import type { z } from "zod"
import type { Conta } from "@/core/accounts/types"
import { MARCA_RITU, RituError } from "@/core/errors"
import { consumirToque } from "@/core/limits/toques"
import type { Container } from "@/infra/container"

export type DepsDaRota = {
  contaDaSessao(): Promise<string | undefined>
  container: Container
  quemPede(request: Request): { ipHash: string; escopo?: string; teto?: number }
}

export type OpcoesDeRota<B> = { corpo?: z.ZodType<B>; limite?: "toque" | "nenhum" }

export type Contexto<B> = {
  conta: Conta
  corpo: B
  request: Request
  container: Container
  ipHash: string
  escopo?: string
  teto?: number
}

export function resposta(status: number, corpo: unknown): Response {
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

const CODIGOS_DE_LIMITE = new Set(["limite_mensagens", "limite_demo", "limite_ip", "limite_toques"])

// O Next carrega cópias dos módulos: o `retryAfterS` é lido do objeto, sem `instanceof`.
export function respostaDeLimite(code: string, erro?: unknown): Response {
  const lido = (erro as { retryAfterS?: unknown } | undefined)?.retryAfterS
  const retryAfterS =
    typeof lido === "number" && Number.isFinite(lido) ? Math.max(1, Math.ceil(lido)) : 1
  return Response.json(
    { erro: code },
    { status: 429, headers: { "Retry-After": String(retryAfterS) } },
  )
}

const STATUS_409 = new Set([
  "run_aberto",
  "run_nao_continuavel",
  "pergunta_expirada",
  "aprovacao_expirada",
  "run_pausado",
])

// O Next carrega os módulos em cópias separadas: o erro lançado pelo container (que vive no
// globalThis) pode ser de outra cópia de `RituError`, e `instanceof` falha. Vale a marca global.
export function ehRituError(e: unknown): e is RituError {
  if (e instanceof RituError) return true
  if (!(e instanceof Error)) return false
  const { code, [MARCA_RITU]: marca } = e as { code?: unknown; [MARCA_RITU]?: unknown }
  return marca === true && typeof code === "string"
}

export function statusDoErro(code: string): number {
  if (code === "run_nao_encontrado") return 404
  if (CODIGOS_DE_LIMITE.has(code)) return 429
  if (STATUS_409.has(code)) return 409
  return 400
}

type Preparado<B> = { ok: true; ctx: Contexto<B> } | { ok: false; resposta: Response }

// Checagens comuns às rotas JSON e às de fluxo: sessão, conta, tamanho e corpo.
export async function prepararContexto<B>(
  deps: DepsDaRota,
  opts: OpcoesDeRota<B>,
  request: Request,
): Promise<Preparado<B>> {
  const { container } = deps
  const contaId = await deps.contaDaSessao()
  const conta = contaId ? await container.stores.accounts.buscar(contaId) : undefined
  if (!conta) return { ok: false, resposta: resposta(401, { erro: "sem_sessao" }) }
  let corpo = undefined as B
  if (opts.corpo) {
    const lido = await lerValidado(request, opts.corpo, container.config.limites.corpoMaximoBytes)
    if (!lido.ok) return lido
    corpo = lido.valor
  }
  const quem = deps.quemPede(request)
  const limite = opts.limite ?? (request.method === "POST" ? "toque" : "nenhum")
  if (limite === "toque") {
    const { limiter, router, clock, telemetry, config } = container
    const consumo = await consumirToque(
      { limiter, router, clock, telemetry },
      {
        conta,
        ipHash: quem.ipHash,
        fuso: config.clima.fusoPadrao,
        escopo: quem.escopo,
        teto: quem.teto,
      },
    )
    if (!consumo.ok) {
      return { ok: false, resposta: respostaDeLimite(consumo.erro.code, consumo.erro) }
    }
  }
  return { ok: true, ctx: { conta, corpo, request, container, ...quem } }
}

export function criarRota<B, R>(
  deps: DepsDaRota,
  opts: OpcoesDeRota<B>,
  fn: (ctx: Contexto<B>) => Promise<R>,
): (request: Request) => Promise<Response> {
  const { container } = deps
  return async (request) => {
    try {
      const preparado = await prepararContexto(deps, opts, request)
      if (!preparado.ok) return preparado.resposta
      return resposta(200, await fn(preparado.ctx))
    } catch (erro) {
      if (ehRituError(erro)) {
        if (statusDoErro(erro.code) === 429) return respostaDeLimite(erro.code, erro)
        return resposta(statusDoErro(erro.code), { erro: erro.code })
      }
      container.telemetry.log("erro_inesperado")
      return resposta(500, { erro: "erro_inesperado" })
    }
  }
}
