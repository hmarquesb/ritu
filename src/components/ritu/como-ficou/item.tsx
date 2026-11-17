"use client"

import { textosComoFicou } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { BowlFood, Check, Coffee, Drop, type Icon, Wind } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { ICON } from "@/components/base/icon-size"
import { Surface } from "@/components/base/surface"
import type { RetornoNaTela } from "@/core/outcomes/visao"

const T = textosComoFicou

const ICONES: Record<RetornoNaTela["tipo"], Icon> = {
  cha: Coffee,
  refeicao: BowlFood,
  oleo: Drop,
  pratica: Wind,
}

type Resultado = "ajudou" | "nao_ajudou" | "nao_fez"

const OPCOES: { resultado: Resultado; rotulo: string }[] = [
  { resultado: "ajudou", rotulo: T.ajudou },
  { resultado: "nao_ajudou", rotulo: T.naoAjudou },
  { resultado: "nao_fez", rotulo: T.naoFez },
]

function rotuloDe(resultado: Resultado): string {
  return (OPCOES.find((o) => o.resultado === resultado)?.rotulo ?? "").toLowerCase()
}

export type ItemDeRetornoProps = {
  retorno: RetornoNaTela
  pendente: Resultado | null
  aoResponder: (id: string, resultado: Resultado) => void
}

export function ItemDeRetorno({ retorno, pendente, aoResponder }: ItemDeRetornoProps) {
  const Glyph = ICONES[retorno.tipo]
  const respondido = retorno.status === "respondido" && retorno.resultado !== null
  return (
    <Surface as="li" tone="surface" shadow="soft" className="flex flex-col gap-3 font-body">
      <div className="flex items-start gap-3">
        <Glyph weight="light" size={ICON.lg} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-title text-title-sm text-ink">{retorno.titulo}</h3>
          {retorno.ingredientes.length > 0 ? (
            <p className="text-caption text-ink-muted">{retorno.ingredientes.join(" · ")}</p>
          ) : null}
        </div>
      </div>
      {respondido && retorno.resultado ? (
        <p role="status" className="flex items-center gap-2 text-body text-ink">
          <Check weight="light" size={ICON.md} aria-hidden="true" className="shrink-0" />
          {formatar(T.anotado, { resultado: rotuloDe(retorno.resultado) })}
        </p>
      ) : (
        <fieldset
          aria-label={formatar(T.grupo, { titulo: retorno.titulo })}
          className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
        >
          {OPCOES.map((o) => (
            <Button
              key={o.resultado}
              variant="secondary"
              size="sm"
              isPending={pendente === o.resultado}
              isDisabled={pendente !== null && pendente !== o.resultado}
              onPress={() => aoResponder(retorno.id, o.resultado)}
            >
              {o.rotulo}
            </Button>
          ))}
        </fieldset>
      )}
    </Surface>
  )
}
