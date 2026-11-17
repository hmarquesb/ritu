"use server"

import { redirect } from "next/navigation"
import { codigoDoErroDeEntrada, signIn, signOut } from "@/infra/auth/next"

const CODIGOS_DE_LIMITE = ["demo_limite_ip", "demo_limite_global"]

export async function entrarNaDemonstracao(): Promise<void> {
  let aviso: string | undefined
  try {
    await signIn("demo", { redirectTo: "/comecar/aviso" })
  } catch (erro) {
    const codigo = codigoDoErroDeEntrada(erro)
    if (codigo === undefined) throw erro // inclui o redirect do Next
    aviso = CODIGOS_DE_LIMITE.includes(codigo) ? codigo : "erro_demo"
  }
  if (aviso) redirect(`/?aviso=${aviso}`)
}

export async function entrarComGoogleAcao(): Promise<void> {
  await signIn("google", { redirectTo: "/conversa" })
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/" })
}
