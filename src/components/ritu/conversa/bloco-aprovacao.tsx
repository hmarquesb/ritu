"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Checkbox } from "@/components/base/checkbox"
import { Surface } from "@/components/base/surface"
import { cx } from "@/components/cx"
import type { VisaoDoRun } from "@/core/conversation/visao"

const T = config.textosConversa.bloco

type BlocoNaTela = NonNullable<VisaoDoRun["bloco"]>

export type BlocoDeAprovacaoProps = {
  bloco: BlocoNaTela
  aoAprovar: (ids: string[]) => void
  className?: string
}

function fraseDoResultado(bloco: BlocoNaTela): string {
  switch (bloco.estado) {
    case "anotado":
      return formatar(T.anotei, {
        n: bloco.linhas.filter((l) => l.decisao === "aprovada").length,
        m: bloco.linhas.length,
      })
    case "recusado":
      return T.nada
    case "seguiu":
      return T.seguiu
    default:
      return T.expirou
  }
}

export function BlocoDeAprovacao({ bloco, aoAprovar, className }: BlocoDeAprovacaoProps) {
  const [marcadas, setMarcadas] = useState<string[]>(() => bloco.linhas.map((l) => l.id))
  const aberto = bloco.estado === "aberto"
  const nenhuma = marcadas.length === 0
  return (
    <Surface tone="raised" className={cx("flex flex-col gap-3 font-body", className)}>
      <h3 className="font-title text-title-sm text-ink">{T.titulo}</h3>
      {aberto ? (
        <>
          <div className="flex flex-col">
            {bloco.linhas.map((linha) => (
              <Checkbox
                key={linha.id}
                isSelected={marcadas.includes(linha.id)}
                onChange={(on) =>
                  setMarcadas((m) => (on ? [...m, linha.id] : m.filter((id) => id !== linha.id)))
                }
              >
                {formatar(T.linha, { linha: linha.texto })}
              </Checkbox>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              aria-disabled={nenhuma || undefined}
              onPress={() => {
                if (!nenhuma) aoAprovar(marcadas)
              }}
            >
              {T.anotar}
            </Button>
            <Button variant="quiet" onPress={() => aoAprovar([])}>
              {T.agoraNao}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-ink-muted">
            {bloco.linhas.map((linha) => (
              <li key={linha.id}>{linha.texto}</li>
            ))}
          </ul>
          <p role="status" className="text-body text-ink">
            {fraseDoResultado(bloco)}
          </p>
        </>
      )}
    </Surface>
  )
}
