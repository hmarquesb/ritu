import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"

export default function Carregando() {
  return <StateBlock kind="loading" title={config.textosConversa.abas.comoFicou} />
}
