// Dados públicos do site: autoria, repositório, idade mínima e a URL do deploy (preenchida depois do primeiro deploy, DEPLOY.md).
export const publico = {
  siteUrl: null as string | null, // ex.: "https://ritu.vercel.app", sem barra final
  repositorio: "https://github.com/hmarquesb/ritu",
  autoria: {
    nome: "Helena Marques Batista",
    github: "https://github.com/hmarquesb",
    linkedin: "https://www.linkedin.com/in/hmarquesb",
  },
  idadeMinima: 18,
} as const
