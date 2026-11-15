import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
}

export default nextConfig
