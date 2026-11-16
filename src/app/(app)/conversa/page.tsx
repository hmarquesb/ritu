import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"

export default function Conversa() {
  return (
    <>
      <h1 className="sr-only">Conversa</h1>
      <StateBlock kind="empty" title={config.textosEntrada.conversa.vazia} />
    </>
  )
}
