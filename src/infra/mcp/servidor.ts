import { config } from "@config/index"
import { createMcpHandler } from "mcp-handler"
import type { z } from "zod"
import { consumirMcp } from "@/core/limits/mcp"
import type { DepsPublicas } from "@/core/mcp/contexto"
import { medirChamadaMcp, type StatusDaTool } from "@/core/mcp/telemetria"
import { TOOLS_PUBLICAS, type ToolPublica } from "@/core/mcp/tools"
import { hashDoIp, ipDoPedido } from "@/infra/auth/ip"
import type { Container } from "@/infra/container"
import { optionalEnv, requireEnv } from "@/infra/env"
import pacote from "../../../package.json"

const INSTRUCOES =
  "Base ayurvédica do Ritu (alimentos, preparos, práticas e combinações) e clima em qualidades. Só leitura. Não é orientação médica."

type Resultado = {
  content: { type: "text"; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

class EntradaInvalida extends Error {
  constructor(readonly campos: string[]) {
    super("entrada_invalida")
  }
}

function erroDeTool(texto: string): Resultado {
  return { content: [{ type: "text", text: texto }], isError: true }
}

// A validação da entrada é da tool (para contar `invalido` e devolver só os campos, sem stack):
// o SDK recebe o schema só para anunciar o `inputSchema` e deixa o valor passar.
function soAnuncia(schema: z.ZodType) {
  const padrao = schema["~standard"]
  return { "~standard": { ...padrao, validate: (value: unknown) => ({ value }) } }
}

function camposInvalidos(erro: z.ZodError): string[] {
  const caminhos = erro.issues.map((i) => (i.path.length ? i.path.join(".") : "(entrada)"))
  return [...new Set(caminhos)]
}

function classificar(resultado: Resultado | undefined, erro?: unknown): StatusDaTool {
  if (erro instanceof EntradaInvalida) return "invalido"
  return erro || !resultado ? "erro" : "ok"
}

async function chamar(
  tool: ToolPublica<unknown, unknown>,
  bruto: unknown,
  deps: DepsPublicas,
): Promise<Resultado> {
  const lido = tool.entrada.safeParse(bruto)
  if (!lido.success) throw new EntradaInvalida(camposInvalidos(lido.error))
  const saida = await tool.executar(lido.data, deps)
  return {
    content: [{ type: "text", text: JSON.stringify(saida) }],
    structuredContent: saida as Record<string, unknown>,
  }
}

function codigoDoErro(erro: unknown): string {
  const codigo = (erro as { code?: unknown } | undefined)?.code
  return typeof codigo === "string" ? codigo : "desconhecido"
}

async function executarMedido(
  tool: ToolPublica<unknown, unknown>,
  bruto: unknown,
  deps: DepsPublicas,
): Promise<Resultado> {
  try {
    return await medirChamadaMcp(
      deps.telemetry,
      tool.nome,
      () => chamar(tool, bruto, deps),
      classificar,
    )
  } catch (erro) {
    if (erro instanceof EntradaInvalida) {
      return erroDeTool(`Entrada inválida. Campos: ${erro.campos.join(", ")}.`)
    }
    deps.telemetry.log("erro_inesperado", { "erro.codigo": codigoDoErro(erro) })
    return erroDeTool("Não consegui responder agora.")
  }
}

export function criarHandlerMcp(container: Container): (req: Request) => Promise<Response> {
  const deps: DepsPublicas = {
    kb: container.knowledge,
    clima: container.weather,
    cidades: container.cities,
    clock: container.clock,
    telemetry: container.telemetry,
  }
  return createMcpHandler(
    (server) => {
      for (const tool of TOOLS_PUBLICAS) {
        server.registerTool(
          tool.nome,
          {
            description: tool.descricao,
            inputSchema: soAnuncia(tool.entrada),
            outputSchema: tool.saida,
            annotations: { readOnlyHint: true, openWorldHint: tool.nome.startsWith("clima_") },
          },
          (bruto: unknown) => executarMedido(tool, bruto, deps),
        )
      }
    },
    { serverInfo: { name: "ritu", version: pacote.version }, instructions: INSTRUCOES },
  )
}

const MENSAGEM_DE_LIMITE = "Limite de uso atingido. Tente de novo mais tarde."

function corpoGrande(): Response {
  return Response.json({ erro: "corpo_grande" }, { status: 413 })
}

function limiteAtingido(retryAfterS: number): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: MENSAGEM_DE_LIMITE }, id: null },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterS))) } },
  )
}

type OpcoesDoPost = { segredo: () => string; modoE2e: boolean }

const OPCOES_DO_AMBIENTE: OpcoesDoPost = {
  segredo: () => requireEnv("IP_HMAC_SECRET"),
  get modoE2e() {
    return optionalEnv("RITU_MODO") === "e2e"
  },
}

// POST: corpo máximo (413 sem consumir), limite por IP e global (429) e, só então, o handler.
export function criarPostMcp(
  container: Container,
  handler: (req: Request) => Promise<Response>,
  opcoes: OpcoesDoPost = OPCOES_DO_AMBIENTE,
): (request: Request) => Promise<Response> {
  const maximo = config.bastidores.mcp.corpoMaximoBytes
  return async (request) => {
    if (Number(request.headers.get("content-length") ?? 0) > maximo) return corpoGrande()
    const texto = await request.text()
    if (new TextEncoder().encode(texto).length > maximo) return corpoGrande()
    const ipHash = hashDoIp(ipDoPedido(request.headers, opcoes.modoE2e), opcoes.segredo())
    const limite = await consumirMcp(
      { limiter: container.limiter, clock: container.clock, telemetry: container.telemetry },
      ipHash,
    )
    if (!limite.ok) return limiteAtingido(limite.erro.retryAfterS)
    return handler(new Request(request, { body: texto }))
  }
}
