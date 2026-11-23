"use client"

import { config } from "@config/index"
import { BowlFood, Coffee, Drop, type Icon, Warning, Wind } from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Sheet } from "@/components/base/dialog"
import { ICON } from "@/components/base/icon-size"
import { Surface } from "@/components/base/surface"
import { cx } from "@/components/cx"
import type { SugestaoNaTela } from "@/core/conversation/visao"
import type { MotivoDaTroca, ResultadoDaTroca } from "@/core/touches/troca"
import { Ingrediente } from "./ingrediente"

const T = config.textosConversa.sugestao

const ICONES: Record<SugestaoNaTela["tipo"], Icon> = {
  cha: Coffee,
  refeicao: BowlFood,
  oleo: Drop,
  pratica: Wind,
}

export type BlocoDeSugestaoProps = {
  sugestao: SugestaoNaTela
  resultadoDaTroca?: { alimento_id: string; resultado: ResultadoDaTroca }
  aoTrocar?: (alimentoId: string, motivo: MotivoDaTroca) => void
  aoResponderTroca?: (
    alimentoId: string,
    candidato: string,
    resposta: "tenho" | "nao_tenho",
  ) => void
  // Conversa de exemplo da landing: só leitura, sem menu, verbos, "Por quê?" nem avaliação.
  exemplo?: boolean
  className?: string
}

const SEM_TROCA = () => undefined

export function BlocoDeSugestao({
  sugestao,
  resultadoDaTroca,
  aoTrocar = SEM_TROCA,
  aoResponderTroca = SEM_TROCA,
  exemplo = false,
  className,
}: BlocoDeSugestaoProps) {
  const [aberto, setAberto] = useState(false)
  const Glyph = ICONES[sugestao.tipo]
  return (
    <Surface
      as="article"
      tone="surface"
      shadow="soft"
      className={cx("flex flex-col gap-3 font-body", className)}
    >
      <header className="flex items-start gap-3">
        <Glyph weight="light" size={ICON.lg} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-title text-title-sm text-ink">{sugestao.titulo}</h3>
          {sugestao.novidade ? (
            <span className="self-start rounded-pill bg-primary-soft px-2.5 py-0.5 text-caption font-medium text-ink">
              {T.novidade}
            </span>
          ) : null}
        </div>
      </header>
      <p className="text-body text-ink">{sugestao.como_fazer}</p>
      {exemplo && sugestao.itens.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {sugestao.itens.map((item) => (
            <li
              key={item.alimento_id}
              className="inline-flex min-h-8 items-center rounded-pill border border-line bg-surface px-3 py-1 font-body text-sm font-medium text-ink"
            >
              {item.nome}
            </li>
          ))}
        </ul>
      ) : null}
      {!exemplo && sugestao.itens.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-2">
          {sugestao.itens.map((item) => (
            <Ingrediente
              key={item.alimento_id}
              item={item}
              podeTrocar={sugestao.podeTrocar}
              resultado={
                resultadoDaTroca?.alimento_id === item.alimento_id
                  ? resultadoDaTroca.resultado
                  : undefined
              }
              aoTrocar={aoTrocar}
              aoResponderTroca={aoResponderTroca}
            />
          ))}
        </ul>
      ) : null}
      {!exemplo && sugestao.verbos.length > 0 ? (
        <p className="text-caption text-ink-muted">{sugestao.verbos.join(" · ")}</p>
      ) : null}
      {sugestao.aviso ? (
        <p className="flex items-start gap-2 rounded-md bg-amber-soft p-3 text-sm text-ink">
          <Warning weight="light" size={ICON.md} aria-hidden="true" className="shrink-0" />
          <span>{sugestao.aviso}</span>
        </p>
      ) : null}
      {exemplo ? null : (
        <div>
          <Button variant="quiet" size="sm" onPress={() => setAberto(true)}>
            {T.porque}
          </Button>
          <Sheet title={sugestao.titulo} isOpen={aberto} onOpenChange={setAberto}>
            <p className="font-body text-body text-ink">{sugestao.motivo}</p>
          </Sheet>
        </div>
      )}
    </Surface>
  )
}
