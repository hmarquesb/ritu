import { ComoFicou } from "@/components/ritu/como-ficou/como-ficou"
import { getContainer } from "@/infra/container"
import { exigirPasso } from "../../_lib/conta"

export default async function PaginaComoFicou() {
  const { conta } = await exigirPasso("pronto")
  const inicial = await getContainer().lerComoFicou(conta.id)
  return <ComoFicou inicial={inicial} />
}
