"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import {
  BatteryLow,
  Cloud,
  Fire,
  type Icon,
  Leaf,
  Lightning,
  PaperPlaneRight,
  Snowflake,
  Sun,
} from "@phosphor-icons/react"
import { useId } from "react"
import { Button } from "@/components/base/button"
import { ToggleChip } from "@/components/base/chip"
import { TextField } from "@/components/base/text-field"
import { cx } from "@/components/cx"

const T = config.textosConversa.caixa

export type Atalho = { id: string; rotulo: string }

const ICONES: Record<string, Icon> = {
  com_frio: Snowflake,
  com_calor: Sun,
  pesada: Cloud,
  seca: Leaf,
  agitada: Lightning,
  irritada: Fire,
  sem_energia: BatteryLow,
}

export type CaixaDeMensagemProps = {
  texto: string
  atalhos: string[]
  atalhosDisponiveis: Atalho[]
  respondendo: boolean
  aoMudar: (v: { texto: string; atalhos: string[] }) => void
  aoEnviar: () => void
  className?: string
}

function motivoDe(o: { respondendo: boolean; longa: boolean; vazia: boolean; n: number }) {
  if (o.respondendo) return T.respondendo
  if (o.longa) return formatar(T.longa, { n: o.n })
  return o.vazia ? T.vazia : null
}

export function CaixaDeMensagem({
  texto,
  atalhos,
  atalhosDisponiveis,
  respondendo,
  aoMudar,
  aoEnviar,
  className,
}: CaixaDeMensagemProps) {
  const motivoId = useId()
  const max = config.conversa.maxCaracteres
  const longa = texto.length > max
  const vazia = texto.trim() === "" && atalhos.length === 0
  const mostraContador = texto.length >= config.telaConversa.contadorAPartirDe
  const motivo = motivoDe({ respondendo, longa, vazia, n: texto.length })
  const bloqueado = respondendo || longa || vazia

  function enviar() {
    if (!bloqueado) aoEnviar()
  }

  function alternar(id: string, marcado: boolean) {
    aoMudar({
      texto,
      atalhos: marcado ? [...atalhos, id] : atalhos.filter((a) => a !== id),
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className={cx(
        "flex flex-col gap-1.5 border-t border-line bg-canvas px-4 pb-2 pt-1.5 font-body",
        className,
      )}
    >
      <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend className="mb-0.5 p-0 text-sm font-medium text-ink">{T.atalhos}</legend>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {atalhosDisponiveis.map((a) => (
            <ToggleChip
              key={a.id}
              icon={ICONES[a.id]}
              className="shrink-0"
              isSelected={atalhos.includes(a.id)}
              onChange={(m) => alternar(a.id, m)}
            >
              {a.rotulo}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <TextField
        multiline
        rows={2}
        label={T.rotulo}
        description={T.apoio}
        value={texto}
        aria-disabled={respondendo || undefined}
        aria-describedby={respondendo ? motivoId : undefined}
        onChange={(v) => aoMudar({ texto: v, atalhos })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            enviar()
          }
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p
          id={motivoId}
          role="status"
          className={cx("text-caption", longa ? "text-danger" : "text-ink-muted")}
        >
          {motivo ?? (mostraContador ? formatar(T.longa, { n: texto.length }) : null)}
        </p>
        <Button
          type="submit"
          variant="primary"
          icon={PaperPlaneRight}
          aria-disabled={bloqueado || undefined}
          aria-describedby={motivo ? motivoId : undefined}
          className={cx(bloqueado && "opacity-50")}
        >
          {T.enviar}
        </Button>
      </div>
    </form>
  )
}
