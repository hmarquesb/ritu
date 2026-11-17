"use client"

import { config } from "@config/index"
import type { ReactNode } from "react"
import { Button } from "@/components/base/button"
import { Dialog } from "@/components/base/dialog"

const T = config.textosVoce

const MESES = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
]

// "3 nov.", no fuso da pessoa, igual no servidor e no navegador.
export function dataCurta(iso: string, fuso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso))
  const dia = partes.find((p) => p.type === "day")?.value ?? ""
  const mes = Number(partes.find((p) => p.type === "month")?.value ?? "1")
  return `${dia} ${MESES[mes - 1] ?? ""}`.trim()
}

export function ListaDeMemoria({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line border-y border-line p-0">
      {children}
    </ul>
  )
}

type Props = {
  /** Texto pequeno acima do principal (rótulo da linha). */
  rotulo?: string
  principal: ReactNode
  complemento?: ReactNode
  acoes?: ReactNode
}

export function ItemDeMemoria({ rotulo, principal, complemento, acoes }: Props) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        {rotulo ? <p className="text-sm text-ink-muted">{rotulo}</p> : null}
        <div className="text-body text-ink">{principal}</div>
        {complemento ? <div className="text-sm text-ink-muted">{complemento}</div> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </li>
  )
}

type ConfirmacaoProps = {
  titulo: string
  texto: string
  confirmar: string
  aberto: boolean
  aoFechar: () => void
  /** Grava; devolve verdadeiro quando o toque mudou a tela. */
  aoConfirmar: () => Promise<boolean>
  pendente?: boolean
}

// `alertdialog`: Esc e "Manter" não gravam; só o botão de perigo grava.
export function Confirmacao({
  titulo,
  texto,
  confirmar,
  aberto,
  aoFechar,
  aoConfirmar,
  pendente = false,
}: ConfirmacaoProps) {
  return (
    <Dialog
      title={titulo}
      description={texto}
      role="alertdialog"
      isOpen={aberto}
      onOpenChange={(valor) => {
        if (!valor) aoFechar()
      }}
    >
      {(close) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onPress={close}>
            {T.manter}
          </Button>
          <Button
            variant="danger"
            isPending={pendente}
            onPress={async () => {
              if (await aoConfirmar()) close()
            }}
          >
            {confirmar}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
