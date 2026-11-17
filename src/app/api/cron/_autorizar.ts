import { timingSafeEqual } from "node:crypto"

export type Autorizacao =
  | { ok: true }
  | { ok: false; status: 401 | 503; erro: "nao_autorizado" | "cron_desligado" }

export function autorizarCron(cabecalho: string | null, segredo: string | undefined): Autorizacao {
  if (!segredo) return { ok: false, status: 503, erro: "cron_desligado" }
  const recebido = Buffer.from(cabecalho ?? "")
  const esperado = Buffer.from(`Bearer ${segredo}`)
  const confere = recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
  return confere ? { ok: true } : { ok: false, status: 401, erro: "nao_autorizado" }
}
