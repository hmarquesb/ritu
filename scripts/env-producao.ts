// ⚠️ Fala com a API da Vercel. Opt-in, fora dos gates.
// Confere quais variáveis de produção estão no projeto: presente, ausente, proibida ou — (local e por_deploy).
//   npm run env:producao
// Sai com 0 quando nada impede o deploy, 1 com obrigatória ausente ou proibida presente, 2 quando a API não responde.
import { ENV_VARS, optionalEnv } from "@/infra/env"
import { linhasDoEnvProducao, nomesEmProducao } from "./lib/env-producao"

const CONFIGURACAO = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]

async function lerNomes(token: string, org: string, projeto: string): Promise<string[] | null> {
  const caminho = `https://api.vercel.com/v10/projects/${encodeURIComponent(projeto)}/env`
  try {
    const resposta = await fetch(`${caminho}?teamId=${encodeURIComponent(org)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resposta.ok) {
      console.error(`A API da Vercel respondeu ${resposta.status}.`)
      return null
    }
    return nomesEmProducao(await resposta.json())
  } catch {
    console.error("A resposta da Vercel não chegou no formato esperado, ou a rede falhou.")
    return null
  }
}

async function main(): Promise<number> {
  const faltam = CONFIGURACAO.filter((nome) => optionalEnv(nome) === undefined)
  if (faltam.length > 0) {
    console.error(`Faltam no .env.local: ${faltam.join(", ")}.`)
    return 2
  }
  const nomes = await lerNomes(
    optionalEnv("VERCEL_TOKEN") ?? "",
    optionalEnv("VERCEL_ORG_ID") ?? "",
    optionalEnv("VERCEL_PROJECT_ID") ?? "",
  )
  if (nomes === null) return 2

  const { linhas, codigo } = linhasDoEnvProducao(ENV_VARS, nomes)
  for (const linha of linhas) console.log(linha)
  return codigo
}

process.exitCode = await main()
