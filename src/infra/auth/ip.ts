import { createHmac } from "node:crypto"

export function ipDoPedido(headers: Headers, modoE2e: boolean): string {
  if (modoE2e) {
    const e2e = headers.get("x-ritu-e2e")?.trim()
    if (e2e) return e2e
  }
  const primeiro = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return primeiro || "desconhecido"
}

export function hashDoIp(ip: string, segredo: string): string {
  return createHmac("sha256", segredo).update(ip).digest("hex").slice(0, 32)
}
