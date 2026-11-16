import type { ReactElement } from "react"
import { StateBlock } from "@/components/base/state-block"

export function SecaoEstados(): ReactElement {
  return (
    <section aria-labelledby="marca-estados" className="flex flex-col gap-6">
      <h2 id="marca-estados" className="font-title text-title font-semibold text-ink">
        Estados
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
        <StateBlock
          kind="loading"
          title="O Ritu está pensando"
          description="Olhando o clima e o que você tem em casa."
        />
        <StateBlock
          kind="error"
          title="Não deu para carregar"
          description="Confira a conexão e tente de novo."
        />
        <StateBlock
          kind="empty"
          title="Sua casa está vazia"
          description="Conte o que tem em casa e as ideias ficam mais certeiras."
        />
        <StateBlock
          kind="waiting"
          title="Esperando você"
          description="O Ritu perguntou algo e segue assim que você responder."
        />
        <StateBlock
          kind="quota"
          title="Por hoje o Ritu descansa"
          description="A cota de conversas acabou. Volte amanhã."
        />
      </div>
    </section>
  )
}
