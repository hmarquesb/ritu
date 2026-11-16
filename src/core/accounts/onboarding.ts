import type { Conta, Perfil } from "@/core/accounts/types"

export type Passo = "aviso" | "evitar" | "dosha" | "pronto"

// Primeiro passo ainda não feito do "Antes de começar". Cidade não entra: ela é opcional e não segura o passo.
export function proximoPasso(conta: Conta, perfil: Perfil): Passo {
  if (conta.aviso_aceito_em === null) return "aviso"
  if (conta.evitar_passo === null) return "evitar"
  if (perfil.prakriti === null && conta.dosha_adiado_em === null) return "dosha"
  return "pronto"
}

export const ROTA_DO_PASSO: Record<Passo, string> = {
  aviso: "/comecar/aviso",
  evitar: "/comecar/evitar",
  dosha: "/comecar/dosha",
  pronto: "/conversa",
}
