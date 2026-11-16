import { redirect } from "next/navigation"
import { type Passo, proximoPasso, ROTA_DO_PASSO } from "@/core/accounts/onboarding"
import type { Conta, Perfil } from "@/core/accounts/types"
import { auth } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"

type SessaoDaConta = { contaId?: string; tipo?: string } | null

type ContaEPerfil = { conta: Conta; perfil: Perfil }

export async function contaAtual(): Promise<ContaEPerfil | undefined> {
  const sessao = (await auth()) as SessaoDaConta
  const contaId = sessao?.contaId
  if (!contaId) return undefined
  const { stores } = getContainer()
  const conta = await stores.accounts.buscar(contaId)
  if (!conta) return undefined
  return { conta, perfil: await stores.profiles.ler(contaId) }
}

export async function exigirPasso(passo: Passo): Promise<ContaEPerfil> {
  const atual = await contaAtual()
  if (!atual) {
    const sessao = (await auth()) as SessaoDaConta
    redirect(sessao?.tipo === "demo" ? "/?aviso=demo_expirou" : "/")
  }
  const proximo = proximoPasso(atual.conta, atual.perfil)
  if (proximo !== passo) redirect(ROTA_DO_PASSO[proximo])
  return atual
}
