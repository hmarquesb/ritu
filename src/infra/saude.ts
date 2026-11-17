import { type EnvSource, optionalEnv } from "@/infra/env"

export type Saude = {
  versao: string | null
  ambiente: "production" | "preview" | "development"
  banco: "ok" | "falhou"
  migracao: string | null
  base: { alimentos: number; preparos: number; praticas: number }
  seed: "ok" | "falhou"
  telemetria: boolean
  google: boolean
}

export type DepsDaSaude = {
  env: EnvSource
  // `select 1`; lança se o banco não responde
  consultarBanco(): Promise<void>
  // nome da última migração aplicada, ou null
  ultimaMigracao(): Promise<string | null>
  contagensDaBase(): { alimentos: number; preparos: number; praticas: number }
  // lê e valida o seed; lança se inválido
  lerSeed(): void
  google(): boolean | Promise<boolean>
  emMemoria?: boolean
  timeoutMs?: number
}

const TIMEOUT_PADRAO_MS = 3000

function ambienteDe(valor: string | undefined): Saude["ambiente"] {
  return valor === "production" || valor === "preview" ? valor : "development"
}

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("timeout")), ms)
  })
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer))
}

async function lerBanco(deps: DepsDaSaude): Promise<Pick<Saude, "banco" | "migracao">> {
  if (deps.emMemoria) return { banco: "ok", migracao: null }
  try {
    const migracao = await comTimeout(
      (async () => {
        await deps.consultarBanco()
        return deps.ultimaMigracao()
      })(),
      deps.timeoutMs ?? TIMEOUT_PADRAO_MS,
    )
    return { banco: "ok", migracao }
  } catch {
    return { banco: "falhou", migracao: null }
  }
}

function lerSeed(deps: DepsDaSaude): Saude["seed"] {
  try {
    deps.lerSeed()
    return "ok"
  } catch {
    return "falhou"
  }
}

export async function lerSaude(deps: DepsDaSaude): Promise<Saude> {
  const { env } = deps
  return {
    versao: optionalEnv("RITU_VERSAO", env) ?? null,
    ambiente: ambienteDe(optionalEnv("VERCEL_ENV", env)),
    ...(await lerBanco(deps)),
    base: deps.contagensDaBase(),
    seed: lerSeed(deps),
    telemetria: optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT", env) !== undefined,
    google: await deps.google(),
  }
}
