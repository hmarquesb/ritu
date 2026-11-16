import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { "/**": ["./data/**/*", "./seed/**/*"] },
}

export default nextConfig
