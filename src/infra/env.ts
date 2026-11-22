import { normalizarEmail } from "@/core/accounts/email"
import { MissingEnvError } from "@/core/errors"

/**
 * Uso em produção: obrigatoria (o deploy falha sem ela), opcional, proibida
 * (o deploy falha com ela), local (só para comandos à mão) e por_deploy (posta
 * pela CI em cada deploy).
 */
export type UsoEmProducao = "obrigatoria" | "opcional" | "proibida" | "local" | "por_deploy"

export type EnvVar = {
  name: string
  entrega: 1 | 2 | 3 | 4
  obrigatoria: boolean
  producao: UsoEmProducao
  descricao: string
}

export type EnvSource = Record<string, string | undefined>

export const ENV_VARS: readonly EnvVar[] = [
  {
    name: "DATABASE_URL",
    entrega: 1,
    obrigatoria: true,
    producao: "obrigatoria",
    descricao: "Postgres. Em produção, a URL do Neon com pooler",
  },
  {
    name: "GEMINI_API_KEY",
    entrega: 1,
    obrigatoria: true,
    producao: "obrigatoria",
    descricao: "Em produção, a chave do projeto de produção",
  },
  {
    name: "GEMINI_API_KEY_2",
    entrega: 3,
    obrigatoria: false,
    producao: "local",
    descricao: "Chave de outro projeto do Google, só para os evals com LLM",
  },
  {
    name: "GEMINI_API_KEY_3",
    entrega: 3,
    obrigatoria: false,
    producao: "local",
    descricao: "Chave de outro projeto do Google, só para os evals com LLM",
  },
  {
    name: "AUTH_SECRET",
    entrega: 3,
    obrigatoria: true,
    producao: "obrigatoria",
    descricao: "Sessão.",
  },
  {
    name: "IP_HMAC_SECRET",
    entrega: 3,
    obrigatoria: true,
    producao: "obrigatoria",
    descricao: "HMAC do IP nos limites.",
  },
  {
    name: "CRON_SECRET",
    entrega: 3,
    obrigatoria: true,
    producao: "obrigatoria",
    descricao: "Autenticação do cron.",
  },
  {
    name: "AUTH_GOOGLE_ID",
    entrega: 3,
    obrigatoria: false,
    producao: "obrigatoria",
    descricao: "Login Google; sem ela a Entrada mostra só a demonstração.",
  },
  {
    name: "AUTH_GOOGLE_SECRET",
    entrega: 3,
    obrigatoria: false,
    producao: "obrigatoria",
    descricao: "Login Google; sem ela a Entrada mostra só a demonstração.",
  },
  {
    name: "RITU_MODO",
    entrega: 3,
    obrigatoria: false,
    producao: "proibida",
    descricao: "e2e: stores em memória para o Playwright. Recusada em produção.",
  },
  {
    name: "TESTER_IDS",
    entrega: 4,
    obrigatoria: false,
    producao: "opcional",
    descricao: "E-mails do Google, separados por vírgula, sem limite de uso.",
  },
  {
    name: "OTEL_EXPORTER_OTLP_ENDPOINT",
    entrega: 1,
    obrigatoria: false,
    producao: "obrigatoria",
    descricao: "Em produção, endpoint e token do Grafana Cloud.",
  },
  {
    name: "OTEL_EXPORTER_OTLP_HEADERS",
    entrega: 4,
    obrigatoria: false,
    producao: "obrigatoria",
    descricao: "Em produção, endpoint e token do Grafana Cloud.",
  },
  {
    name: "OTEL_SERVICE_NAME",
    entrega: 1,
    obrigatoria: false,
    producao: "opcional",
    descricao: "Padrão ritu.",
  },
  {
    name: "RITU_VERSAO",
    entrega: 4,
    obrigatoria: false,
    producao: "por_deploy",
    descricao: "Sha do commit, posto pela CI em cada deploy.",
  },
  {
    name: "VERCEL_TOKEN",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `env:producao` à mão.",
  },
  {
    name: "VERCEL_ORG_ID",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `env:producao` à mão.",
  },
  {
    name: "VERCEL_PROJECT_ID",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `env:producao` à mão.",
  },
  {
    name: "GRAFANA_URL",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `painel:publicar`.",
  },
  {
    name: "GRAFANA_TOKEN",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `painel:publicar`.",
  },
  {
    name: "GRAFANA_ALERTA_EMAIL",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "Para `painel:publicar`.",
  },
  {
    name: "SITE_URL",
    entrega: 4,
    obrigatoria: false,
    producao: "local",
    descricao: "URL de produção, para `smoke` e `smoke:completo`.",
  },
]

function valorPresente(valor: string | undefined): string | undefined {
  return valor === undefined || valor.trim() === "" ? undefined : valor
}

export function requireEnv(name: string, env: EnvSource = process.env): string {
  const valor = valorPresente(env[name])
  if (valor === undefined) {
    throw new MissingEnvError(name)
  }
  return valor
}

export function optionalEnv(name: string, env: EnvSource = process.env): string | undefined {
  return valorPresente(env[name])
}

/** E-mails de TESTER_IDS, normalizados e sem itens vazios. */
export function testers(env: EnvSource = process.env): string[] {
  const valor = optionalEnv("TESTER_IDS", env)
  if (valor === undefined) return []
  return valor
    .split(",")
    .map((item) => normalizarEmail(item))
    .filter((item) => item !== "")
}

export function envStatus(env: EnvSource = process.env): {
  name: string
  entrega: number
  obrigatoria: boolean
  presente: boolean
}[] {
  return ENV_VARS.map((variavel) => ({
    name: variavel.name,
    entrega: variavel.entrega,
    obrigatoria: variavel.obrigatoria,
    presente: valorPresente(env[variavel.name]) !== undefined,
  }))
}

/**
 * Aponta o que impede o deploy: obrigatórias de produção ausentes e proibidas presentes.
 * `local` e `por_deploy` não entram. Listas na ordem do catálogo.
 */
export function faltandoEmProducao(
  catalogo: readonly EnvVar[],
  nomes: readonly string[],
): { ausentes: string[]; proibidas: string[] } {
  const presentes = new Set(nomes)
  return {
    ausentes: catalogo
      .filter((item) => item.producao === "obrigatoria" && !presentes.has(item.name))
      .map((item) => item.name),
    proibidas: catalogo
      .filter((item) => item.producao === "proibida" && presentes.has(item.name))
      .map((item) => item.name),
  }
}
