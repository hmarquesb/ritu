"use client"

import { type ReactElement, useState } from "react"
import { Button } from "@/components/base/button"

export function SecaoMovimento(): ReactElement {
  const [run, setRun] = useState(0)
  return (
    <section aria-labelledby="marca-movimento" className="flex flex-col items-start gap-6">
      <h2 id="marca-movimento" className="font-title text-title font-semibold text-ink">
        Movimento
      </h2>
      <p className="max-w-prose text-prose text-ink-muted">
        A entrada <code>rise</code> é curta e suave. Com movimento reduzido no sistema, ela some.
      </p>
      <div
        key={run}
        className="animate-rise max-w-prose rounded-lg bg-surface p-5 text-prose text-ink"
      >
        Um chá de gengibre com canela agora, que o dia esfriou.
      </div>
      <Button variant="secondary" onPress={() => setRun((n) => n + 1)}>
        Repetir animação
      </Button>
    </section>
  )
}
