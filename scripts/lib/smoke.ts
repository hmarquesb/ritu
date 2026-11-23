import { z } from "zod"

export type Checagem = {
  grupo: "versao" | "saude" | "pagina" | "headers" | "protecao" | "publico"
  nome: string
  ok: boolean
  detalhe: string
}

const SAUDE = z.object({
  versao: z.string().nullable(),
  ambiente: z.enum(["production", "preview", "development"]),
  banco: z.enum(["ok", "falhou"]),
  migracao: z.string().nullable(),
  base: z.object({
    alimentos: z.number().int().nonnegative(),
    preparos: z.number().int().nonnegative(),
    praticas: z.number().int().nonnegative(),
  }),
  seed: z.enum(["ok", "falhou"]),
  telemetria: z.boolean(),
  google: z.boolean(),
})

type Saude = z.infer<typeof SAUDE>

const VERSAO_DO_CORPO = z.object({ versao: z.string().nullable() })

const AVISO = "Não é orientação médica"
const ANO_EM_SEGUNDOS = 31536000

function checagem(grupo: Checagem["grupo"], nome: string, ok: boolean, detalhe: string): Checagem {
  return { grupo, nome, ok, detalhe: ok ? detalhe : `falhou: ${detalhe}` }
}

export function versaoChegou(s: unknown, esperada: string): boolean {
  const lida = VERSAO_DO_CORPO.safeParse(s)
  return lida.success && lida.data.versao === esperada
}

export function ultimaMigracao(arquivos: readonly string[]): string {
  const sql = arquivos.filter((nome) => nome.endsWith(".sql")).sort()
  return sql.at(-1) ?? ""
}

function checarVersao(s: unknown, esperada: string): Checagem {
  const ok = versaoChegou(s, esperada)
  return checagem("versao", "versao", ok, `esperada ${esperada}`)
}

function checagensDaBase(saude: Saude): Checagem[] {
  const { alimentos, preparos, praticas } = saude.base
  const ok = alimentos > 0 && preparos > 0 && praticas > 0
  const detalhe = `alimentos ${alimentos}, preparos ${preparos}, praticas ${praticas}`
  return [checagem("saude", "base", ok, detalhe)]
}

function checagensDeSaude(saude: Saude, esperado: { ultimaMigracao: string }): Checagem[] {
  return [
    checagem("saude", "banco", saude.banco === "ok", `banco ${saude.banco}`),
    checagem("saude", "seed", saude.seed === "ok", `seed ${saude.seed}`),
    ...checagensDaBase(saude),
    checagem(
      "saude",
      "migracao",
      saude.migracao === esperado.ultimaMigracao,
      `esperada ${esperado.ultimaMigracao}, recebida ${saude.migracao ?? "nenhuma"}`,
    ),
    checagem("saude", "telemetria", saude.telemetria === true, "telemetria ligada"),
    checagem("saude", "google", saude.google === true, "login Google configurado"),
    checagem("saude", "ambiente", saude.ambiente === "production", `ambiente ${saude.ambiente}`),
  ]
}

export function checarSaude(
  s: unknown,
  esperado: { versao?: string; ultimaMigracao: string },
): Checagem[] {
  const versao = esperado.versao === undefined ? [] : [checarVersao(s, esperado.versao)]
  const lida = SAUDE.safeParse(s)
  if (!lida.success) {
    return [checagem("saude", "formato", false, "corpo fora do formato esperado"), ...versao]
  }
  return [...checagensDeSaude(lida.data, esperado), ...versao]
}

export function checarPagina(status: number, html: string): Checagem[] {
  return [
    checagem("pagina", "status", status === 200, `status ${status}`),
    checagem("pagina", "aviso", html.includes(AVISO), "aviso de orientação médica"),
  ]
}

function diretivas(csp: string): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const parte of csp.split(";")) {
    const [nome, ...valores] = parte.trim().split(/\s+/)
    if (nome && !mapa.has(nome.toLowerCase())) mapa.set(nome.toLowerCase(), valores)
  }
  return mapa
}

function checarCsp(csp: string): Checagem[] {
  const mapa = diretivas(csp)
  const script = mapa.get("script-src") ?? mapa.get("default-src")
  const ancestrais = mapa.get("frame-ancestors") ?? []
  return [
    checagem("headers", "CSP nonce", csp.includes("nonce-"), "nonce- esperado na CSP"),
    checagem(
      "headers",
      "CSP frame-ancestors",
      ancestrais.includes("'none'"),
      "frame-ancestors 'none' esperado",
    ),
    checagem(
      "headers",
      "CSP script-src sem unsafe-inline",
      script !== undefined && !script.includes("'unsafe-inline'"),
      "script-src sem 'unsafe-inline'",
    ),
  ]
}

function checarHsts(valor: string): Checagem {
  const casamento = /max-age=(\d+)/i.exec(valor)
  const ok = casamento !== null && Number(casamento[1]) >= ANO_EM_SEGUNDOS
  return checagem("headers", "strict-transport-security", ok, "max-age de pelo menos um ano")
}

function checarPermissoes(valor: string): Checagem {
  const ok = ["camera=()", "microphone=()", "geolocation=()"].every((d) => valor.includes(d))
  return checagem(
    "headers",
    "permissions-policy",
    ok,
    "camera, microphone e geolocation desligados",
  )
}

export function checarHeaders(h: Headers): Checagem[] {
  return [
    ...checarCsp(h.get("content-security-policy") ?? ""),
    checagem(
      "headers",
      "x-content-type-options",
      h.get("x-content-type-options") === "nosniff",
      "nosniff esperado",
    ),
    checagem(
      "headers",
      "referrer-policy",
      h.get("referrer-policy") === "strict-origin-when-cross-origin",
      "strict-origin-when-cross-origin esperado",
    ),
    checarPermissoes(h.get("permissions-policy") ?? ""),
    checarHsts(h.get("strict-transport-security") ?? ""),
  ]
}

const TOOLS_DO_MCP = [
  "ayurveda_alimento",
  "ayurveda_candidatos",
  "ayurveda_substitutos",
  "ayurveda_checar_combinacao",
  "clima_agora",
  "clima_proximas_horas",
]

const FRASES_DO_SOBRE = ["Privacidade", AVISO]

function checarSobre(sobre: { status: number; html: string }): Checagem {
  if (sobre.status !== 200) {
    return checagem("publico", "sobre", false, `status ${sobre.status}, esperado 200`)
  }
  const faltam = FRASES_DO_SOBRE.filter((frase) => !sobre.html.includes(frase))
  return checagem(
    "publico",
    "sobre",
    faltam.length === 0,
    faltam.length === 0 ? "status 200 e as frases esperadas" : `faltam ${faltam.join(", ")}`,
  )
}

export function checarPublico(r: {
  bastidores: number
  toolsDoMcp: string[]
  sobre: { status: number; html: string }
}): Checagem[] {
  const faltam = TOOLS_DO_MCP.filter((tool) => !r.toolsDoMcp.includes(tool))
  return [
    checagem("publico", "bastidores", r.bastidores === 200, `status ${r.bastidores}, esperado 200`),
    checagem(
      "publico",
      "mcp tools/list",
      faltam.length === 0,
      faltam.length === 0 ? "seis tools" : `faltam ${faltam.join(", ")}`,
    ),
    checarSobre(r.sobre),
  ]
}

export function checarProtecao(r: { cronSemBearer: number; postSemOrigin: number }): Checagem[] {
  return [
    checagem(
      "protecao",
      "cron sem bearer",
      r.cronSemBearer === 401,
      `status ${r.cronSemBearer}, esperado 401`,
    ),
    checagem(
      "protecao",
      "post sem origin",
      r.postSemOrigin === 403,
      `status ${r.postSemOrigin}, esperado 403`,
    ),
  ]
}
