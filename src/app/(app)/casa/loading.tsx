import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"

export default function CarregandoCasa() {
  return <StateBlock kind="loading" title={config.textosCasa.titulo} />
}
