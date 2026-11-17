import { z } from "zod"
import { type EnvVar, faltandoEmProducao } from "@/infra/env"

// Parte sem rede do `env:producao`: lê a resposta da API da Vercel e monta as linhas. Nunca lê nem imprime valor.
const RESPOSTA = z.object({
  envs: z.array(
    z.looseObject({
      key: z.string(),
      target: z.union([z.string(), z.array(z.string())]).optional(),
    }),
  ),
})

function alvoEProducao(alvo: string | string[] | undefined): boolean {
  if (alvo === undefined) return false
  return typeof alvo === "string" ? alvo === "production" : alvo.includes("production")
}

/** Nomes das variáveis com alvo `production` (lista ou texto). Resposta fora do formato lança erro. */
export function nomesEmProducao(resposta: unknown): string[] {
  const lida = RESPOSTA.parse(resposta)
  const nomes = lida.envs.filter((item) => alvoEProducao(item.target)).map((item) => item.key)
  return [...new Set(nomes)]
}

/** Uma linha por variável do catálogo. Código 1 com obrigatória ausente ou proibida presente. */
export function linhasDoEnvProducao(
  catalogo: readonly EnvVar[],
  nomes: readonly string[],
): { linhas: string[]; codigo: 0 | 1 } {
  const presentes = new Set(nomes)
  const largura = Math.max(...catalogo.map((variavel) => variavel.name.length))
  const linhas = catalogo.map(
    (variavel) => `${variavel.name.padEnd(largura)}  ${estadoDe(variavel, presentes)}`,
  )
  const { ausentes, proibidas } = faltandoEmProducao(catalogo, nomes)
  return { linhas, codigo: ausentes.length + proibidas.length > 0 ? 1 : 0 }
}

function estadoDe(variavel: EnvVar, presentes: Set<string>): string {
  if (variavel.producao === "local" || variavel.producao === "por_deploy") return "—"
  if (!presentes.has(variavel.name)) return "ausente"
  return variavel.producao === "proibida" ? "proibida" : "presente"
}
