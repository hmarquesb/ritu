import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"
import { exigirPasso } from "../../../_lib/conta"

export default async function ComoPensei() {
  await exigirPasso("pronto")
  return (
    <>
      <h1 className="mb-6 font-title text-title font-semibold">
        {config.textosConversa.comoPensei.titulo}
      </h1>
      <StateBlock kind="empty" title={config.textosConversa.emBreve} />
    </>
  )
}
