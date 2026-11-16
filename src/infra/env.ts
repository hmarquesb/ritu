import { MissingEnvError } from "@/core/errors"

export type EnvVar = {
  name: string
  entrega: 1 | 2 | 3 | 4
  obrigatoria: boolean
  descricao: string
}

export type EnvSource = Record<string, string | undefined>

export const ENV_VARS: readonly EnvVar[] = [
  {
    name: "DATABASE_URL",
    entrega: 1,
    obrigatoria: true,
    descricao: "Postgres.",
  },
  {
    name: "GEMINI_API_KEY",
    entrega: 1,
    obrigatoria: true,
    descricao: "Chave do projeto de desenvolvimento; só os comandos ⚠️ a usam.",
  },
  {
    name: "AUTH_SECRET",
    entrega: 3,
    obrigatoria: true,
    descricao: "Sessão.",
  },
  {
    name: "IP_HMAC_SECRET",
    entrega: 3,
    obrigatoria: true,
    descricao: "HMAC do IP nos limites.",
  },
  {
    name: "CRON_SECRET",
    entrega: 3,
    obrigatoria: true,
    descricao: "Autenticação do cron.",
  },
  {
    name: "AUTH_GOOGLE_ID",
    entrega: 3,
    obrigatoria: false,
    descricao: "Login Google; sem ela a Entrada mostra só a demonstração.",
  },
  {
    name: "AUTH_GOOGLE_SECRET",
    entrega: 3,
    obrigatoria: false,
    descricao: "Login Google; sem ela a Entrada mostra só a demonstração.",
  },
  {
    name: "RITU_MODO",
    entrega: 3,
    obrigatoria: false,
    descricao: "e2e: stores em memória para o Playwright. Recusada em produção.",
  },
  {
    name: "TESTER_IDS",
    entrega: 4,
    obrigatoria: false,
    descricao: "Contas com limite ampliado.",
  },
  {
    name: "OTEL_EXPORTER_OTLP_ENDPOINT",
    entrega: 1,
    obrigatoria: false,
    descricao: "Sem ela a telemetria fica desligada. Dev: http://localhost:4318.",
  },
  {
    name: "OTEL_EXPORTER_OTLP_HEADERS",
    entrega: 4,
    obrigatoria: false,
    descricao: "Token do Grafana Cloud.",
  },
  {
    name: "OTEL_SERVICE_NAME",
    entrega: 1,
    obrigatoria: false,
    descricao: "Padrão ritu.",
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
