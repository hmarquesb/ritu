import { config } from "@config/index"
import type { Stores } from "@/core/stores"

// O fuso da conta (perfil ou o padrão): Minha casa, Você e Como pensei leem o mesmo.
export async function fusoDaConta(
  stores: Pick<Stores, "profiles">,
  contaId: string,
): Promise<string> {
  const perfil = await stores.profiles.ler(contaId)
  return perfil?.cidade_fuso ?? config.clima.fusoPadrao
}
