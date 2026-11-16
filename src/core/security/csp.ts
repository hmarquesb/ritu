export function montarCsp(p: { nonce: string; dev: boolean }): string {
  const nonce = `'nonce-${p.nonce}'`
  const eval_ = p.dev ? " 'unsafe-eval'" : ""
  return [
    "default-src 'self'",
    `script-src 'self' ${nonce} 'strict-dynamic'${eval_}`,
    `style-src 'self' ${nonce}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ")
}

export function headersDeSeguranca(p: {
  nonce: string
  dev: boolean
  https: boolean
}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": montarCsp(p),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  }
  if (p.https) headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
  return headers
}
