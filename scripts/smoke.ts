// ⚠️ Confere a produção no ar: versão, saúde, página, cabeçalhos e proteções. Opt-in, fora dos gates.
// Não chama modelo nem cria conta. Precisa de CRON_SECRET no .env.local.
//   npm run smoke -- <url>        (ou SITE_URL)
// Com RITU_VERSAO_ESPERADA, espera até 120 s a versão chegar. Sai com 1 no primeiro grupo que falha.
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { optionalEnv } from "@/infra/env"
import {
  type Checagem,
  checarHeaders,
  checarPagina,
  checarProtecao,
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
  ]
  for (const grupo of grupos) {
    const checagens = await grupo()
    for (const checagem of checagens) console.log(linhaDe(checagem))
    if (checagens.some((c) => !c.ok)) return 1
  }
  return 0
}

process.exitCode = await main()
