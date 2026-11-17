"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { ShoppingBag } from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Sheet } from "@/components/base/dialog"
import { ICON } from "@/components/base/icon-size"
import { Surface } from "@/components/base/surface"
import { cx } from "@/components/cx"
import type { VisaoDoRun } from "@/core/conversation/visao"

const T = config.textosConversa.paraTer
const PORQUE = config.textosConversa.sugestao.porque

export type LinhaParaTerProps = {
  paraTer: NonNullable<VisaoDoRun["para_ter"]>
  className?: string
}

export function LinhaParaTer({ paraTer, className }: LinhaParaTerProps) {
  const [aberto, setAberto] = useState(false)
  const rotulo = formatar(T.rotulo, { item: paraTer.nome })
  return (
    <Surface
      tone="sunken"
      padding="sm"
      className={cx("flex flex-col gap-1.5 font-body", className)}
    >
      <p className="flex items-center gap-2 text-body font-medium text-ink">
        <ShoppingBag weight="light" size={ICON.md} aria-hidden="true" className="shrink-0" />
        {rotulo}
      </p>
      <p className="text-sm text-ink-muted">{formatar(T.vezes, { n: paraTer.vezes })}</p>
      {paraTer.verbos.length > 0 ? (
        <p className="text-caption text-ink-muted">{paraTer.verbos.join(" · ")}</p>
      ) : null}
      <div>
        <Button variant="quiet" size="sm" onPress={() => setAberto(true)}>
          {PORQUE}
        </Button>
        <Sheet title={rotulo} isOpen={aberto} onOpenChange={setAberto}>
          <p className="font-body text-body text-ink">{paraTer.motivo}</p>
        </Sheet>
      </div>
    </Surface>
  )
}
