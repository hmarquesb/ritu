"use client"

import type { Icon } from "@phosphor-icons/react"
import { useEffect } from "react"
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { Spinner } from "@/components/base/spinner"
import { cx } from "@/components/cx"

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger"
export type ButtonSize = "md" | "sm"

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  icon?: Icon
  className?: string
}

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary data-hovered:bg-primary-hover data-pressed:bg-primary-pressed",
  secondary:
    "bg-surface text-ink border border-line-strong data-hovered:bg-raised data-pressed:bg-sunken",
  quiet: "bg-transparent text-ink data-hovered:bg-sunken data-pressed:bg-sunken",
  danger: "bg-danger text-canvas data-hovered:opacity-90 data-pressed:opacity-80",
}

const BASE =
  "relative inline-flex items-center justify-center gap-2 rounded-pill text-center font-body font-medium cursor-pointer select-none " +
  "transition-[transform,background-color,opacity] duration-[var(--ritu-fast)] ease-ritu " +
  "data-pressed:scale-[0.98] data-disabled:opacity-50 data-disabled:cursor-not-allowed data-pending:cursor-progress"

// Padding, texto e altura ficam só aqui: duas classes da mesma propriedade no
// mesmo elemento não se sobrepõem pela ordem do className, e sim pela da folha.
// `sm`: 2.25rem visuais; a área de toque (3rem, para cobrir os 2.75rem mesmo com borda) vem do pseudo-elemento.
const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 py-2 text-body",
  sm: "min-h-9 px-4 py-1 text-sm after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
}

type AnnouncementDocument = Pick<Document, "querySelectorAll" | "getElementById">

/**
 * O React Aria anuncia o botão pendente com `role="img"` e `aria-labelledby`
 * apontando para o próprio botão. Se a navegação desmonta o botão, o anúncio
 * fica por sete segundos no `role="log"` sem o elemento que lhe dá o nome.
 * Remove esses anúncios órfãos.
 */
export function removeOrphanAnnouncements(doc: AnnouncementDocument): void {
  for (const node of doc.querySelectorAll("[data-live-announcer] [role='img'][aria-labelledby]")) {
    const ids = (node.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean)
    if (ids.length === 0 || ids.some((id) => !doc.getElementById(id))) node.remove()
  }
}

/**
 * O primeiro anúncio da página só entra no DOM 100 ms depois do pedido (o
 * React Aria espera o `role="log"` existir), então um botão que sai antes disso
 * deixa o anúncio chegar depois da limpeza. Repete a limpeza em intervalos
 * curtos para pegar esse caso também.
 */
export const ORPHAN_CLEANUP_DELAYS = [0, 150, 500, 1500] as const

export function scheduleOrphanCleanup(
  doc: AnnouncementDocument,
  schedule: (fn: () => void, delay: number) => unknown = setTimeout,
): void {
  for (const delay of ORPHAN_CLEANUP_DELAYS) {
    schedule(() => removeOrphanAnnouncements(doc), delay)
  }
}

function PendingCleanup() {
  useEffect(
    () => () => {
      scheduleOrphanCleanup(document)
    },
    [],
  )
  return null
}

export function Button({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  icon: IconComponent,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={cx(BASE, BUTTON_VARIANT[variant], SIZE[size], fullWidth && "w-full", className)}
    >
      {(renderProps) => (
        <>
          <span
            className={cx(
              "inline-flex items-center justify-center gap-2",
              renderProps.isPending && "opacity-0",
            )}
          >
            {IconComponent ? (
              <IconComponent
                weight="light"
                size={size === "sm" ? ICON.sm : ICON.md}
                aria-hidden="true"
              />
            ) : null}
            {typeof children === "function" ? children(renderProps) : children}
          </span>
          {renderProps.isPending ? (
            <span className="absolute inset-0 inline-flex items-center justify-center">
              <PendingCleanup />
              <Spinner label="Carregando" />
            </span>
          ) : null}
        </>
      )}
    </AriaButton>
  )
}
