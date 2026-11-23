import { publico } from "@config/publico"
import type { MetadataRoute } from "next"

const publicas = ["/", "/sobre", "/bastidores", "/marca/og.jpg"]
const bloqueadas = ["/api/", "/comecar/", "/conversa", "/casa", "/como-ficou", "/voce", "/marca"]

export default function robots(): MetadataRoute.Robots {
  const siteUrl = publico.siteUrl
  return {
    rules: { userAgent: "*", allow: publicas, disallow: bloqueadas },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  }
}
