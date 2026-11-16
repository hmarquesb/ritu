import { type NextRequest, NextResponse } from "next/server"
import { headersDeSeguranca } from "@/core/security/csp"
import { origemValida } from "@/core/security/origem"

function novoNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64")
}

function aplicar(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [nome, valor] of Object.entries(headers)) response.headers.set(nome, valor)
  return response
}

export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol
  const nonce = novoNonce()
  const headers = headersDeSeguranca({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    https: proto.replace(":", "") === "https",
  })

  const permitido = origemValida({
    metodo: request.method,
    origin: request.headers.get("origin"),
    host,
  })
  if (!permitido) {
    return aplicar(NextResponse.json({ erro: "origem_invalida" }, { status: 403 }), headers)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"] ?? "")
  return aplicar(NextResponse.next({ request: { headers: requestHeaders } }), headers)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
}
