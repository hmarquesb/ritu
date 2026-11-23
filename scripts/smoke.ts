// ⚠️ Confere a produção no ar: versão, saúde, página, cabeçalhos, proteções e as portas públicas (Bastidores, Sobre e MCP). Opt-in, fora dos gates.
// Não chama modelo nem cria conta. Precisa de CRON_SECRET no .env.local.
//   npm run smoke -- <url>        (ou SITE_URL)
// Com RITU_VERSAO_ESPERADA, espera até 120 s a versão chegar. Sai com 1 no primeiro grupo que falha.
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { optionalEnv } from "@/infra/env"
import {
  type Checagem,
  checarHeaders,
  checarPagina,
  checarProtecao,
  checarPublico,
  checarSaude,
  ultimaMigracao,
  versaoChegou,
} from "./lib/smoke"

const RAIZ = fileURLToPath(new URL("../", import.meta.url))
const PAUSA_MS = 5000
const LIMITE_VERSAO_MS = 120_000

type Contexto = { base: string; segredo: string; versao?: string; ultimaMigracao: string }

async function pausa(ms: number): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, ms))
}

async function lerSaude(ctx: Contexto): Promise<unknown> {
  try {
    const resposta = await fetch(`${ctx.base}/api/saude`, {
      headers: { Authorization: `Bearer ${ctx.segredo}` },
    })
    return await resposta.json()
  } catch {
    return undefined
  }
}

async function esperarVersao(ctx: Contexto, versao: string): Promise<unknown> {
  const inicio = Date.now()
  let corpo = await lerSaude(ctx)
  while (!versaoChegou(corpo, versao) && Date.now() - inicio < LIMITE_VERSAO_MS) {
    await pausa(PAUSA_MS)
    corpo = await lerSaude(ctx)
  }
  return corpo
}

async function lerPagina(
  base: string,
): Promise<{ status: number; html: string; headers: Headers }> {
  try {
    const resposta = await fetch(`${base}/`)
    return { status: resposta.status, html: await resposta.text(), headers: resposta.headers }
  } catch {
    return { status: 0, html: "", headers: new Headers() }
  }
}

async function statusDe(url: string, init?: RequestInit): Promise<number> {
  try {
    return (await fetch(url, init)).status
  } catch {
    return 0
  }
}

async function checagensDeProtecao(base: string): Promise<Checagem[]> {
  const cronSemBearer = await statusDe(`${base}/api/cron/limpeza`)
  const postSemOrigin = await statusDe(`${base}/api/lista`, { method: "POST" })
  return checarProtecao({ cronSemBearer, postSemOrigin })
}

const PROTOCOLO_MCP = "2025-11-25"
const RESPOSTA_TOOLS = z.object({
  result: z.object({ tools: z.array(z.object({ name: z.string() })) }).optional(),
})

async function pedirAoMcp(
  base: string,
  corpo: object,
  sessao?: string,
): Promise<Response | undefined> {
  try {
    return await fetch(`${base}/api/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOLO_MCP,
        ...(sessao === undefined ? {} : { "mcp-session-id": sessao }),
      },
      body: JSON.stringify(corpo),
    })
  } catch {
    return undefined
  }
}

function nomesDasTools(texto: string, contentType: string | null): string[] {
  const textos = contentType?.includes("text/event-stream")
    ? texto
        .split("\n")
        .filter((linha) => linha.startsWith("data:"))
        .map((linha) => linha.slice("data:".length).trim())
    : [texto]
  for (const bruto of textos) {
    const lida = RESPOSTA_TOOLS.safeParse(parseJson(bruto))
    if (lida.success && lida.data.result) return lida.data.result.tools.map((t) => t.name)
  }
  return []
}

function parseJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}

async function lerToolsDoMcp(base: string): Promise<string[]> {
  const init = await pedirAoMcp(base, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOLO_MCP,
      capabilities: {},
      clientInfo: { name: "ritu-smoke", version: "1.0.0" },
    },
  })
  if (init?.ok !== true) return []
  const sessao = init.headers.get("mcp-session-id") ?? undefined
  const lista = await pedirAoMcp(base, { jsonrpc: "2.0", id: 2, method: "tools/list" }, sessao)
  if (lista?.ok !== true) return []
  return nomesDasTools(await lista.text(), lista.headers.get("content-type"))
}

async function lerSobre(base: string): Promise<{ status: number; html: string }> {
  try {
    const resposta = await fetch(`${base}/sobre`)
    return { status: resposta.status, html: await resposta.text() }
  } catch {
    return { status: 0, html: "" }
  }
}

async function checagensPublicas(base: string): Promise<Checagem[]> {
  const bastidores = await statusDe(`${base}/bastidores`)
  return checarPublico({
    bastidores,
    toolsDoMcp: await lerToolsDoMcp(base),
    sobre: await lerSobre(base),
  })
}

function linhaDe(checagem: Checagem): string {
  const marca = checagem.ok ? "ok     " : "FALHOU "
  return `${marca}${checagem.grupo} · ${checagem.nome} · ${checagem.detalhe}`
}

function obterSaude(ctx: Contexto): Promise<unknown> {
  return ctx.versao === undefined ? lerSaude(ctx) : esperarVersao(ctx, ctx.versao)
}

async function main(): Promise<number> {
  const base = (process.argv[2] ?? optionalEnv("SITE_URL") ?? "").replace(/\/$/, "")
  if (base === "") {
    console.error("Uso: npm run smoke -- <url>, ou defina SITE_URL no .env.local.")
    return 2
  }
  const segredo = optionalEnv("CRON_SECRET")
  if (segredo === undefined) {
    console.error("Falta CRON_SECRET no .env.local.")
    return 2
  }
  const migracao = ultimaMigracao(readdirSync(resolve(RAIZ, "db/migrations")))
  const ctx: Contexto = {
    base,
    segredo,
    versao: optionalEnv("RITU_VERSAO_ESPERADA"),
    ultimaMigracao: migracao,
  }
  const saude = await obterSaude(ctx)
  const pagina = await lerPagina(base)

  const grupos: (() => Checagem[] | Promise<Checagem[]>)[] = [
    () =>
      ctx.versao === undefined
        ? []
        : checarSaude(saude, { versao: ctx.versao, ultimaMigracao: migracao }).filter(
            (c) => c.grupo === "versao",
          ),
    () => checarSaude(saude, { ultimaMigracao: migracao }).filter((c) => c.grupo === "saude"),
    () => checarPagina(pagina.status, pagina.html),
    () => checarHeaders(pagina.headers),
    () => checagensDeProtecao(base),
    () => checagensPublicas(base),
  ]
  for (const grupo of grupos) {
    const checagens = await grupo()
    for (const checagem of checagens) console.log(linhaDe(checagem))
    if (checagens.some((c) => !c.ok)) return 1
  }
  return 0
}

process.exitCode = await main()
