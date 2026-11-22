import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/**": ["./data/**/*", "./seed/**/*", "./evals/resultados/historico.json"],
  },
}

export default nextConfig
