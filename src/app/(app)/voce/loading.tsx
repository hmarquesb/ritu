import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"

export default function CarregandoVoce() {
  return <StateBlock kind="loading" title={config.textosVoce.titulo} />
}
