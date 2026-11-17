import { MinhaCasa } from "@/components/ritu/casa/minha-casa"
import { getContainer } from "@/infra/container"
import { exigirPasso } from "../../_lib/conta"

export default async function Casa() {
  const { conta } = await exigirPasso("pronto")
  const casa = await getContainer().lerCasa(conta.id)
  return <MinhaCasa inicial={casa} />
}
