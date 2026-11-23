import { publico } from "@config/publico"
import type { MetadataRoute } from "next"

const paginas = ["", "/sobre", "/bastidores"]

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = publico.siteUrl
  if (!siteUrl) return []
  return paginas.map((caminho) => ({ url: `${siteUrl}${caminho}` }))
}
