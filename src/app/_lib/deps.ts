import { auth } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"
import type { DepsDaRota } from "./rota"

export function depsReais(): DepsDaRota {
  return {
    contaDaSessao: async () => ((await auth()) as { contaId?: string } | null)?.contaId,
    container: getContainer(),
  }
}
