"use client"

import type { Icon } from "@phosphor-icons/react"
import {
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

type Nome =
  | { "aria-label": string; children?: React.ReactNode }
  | { "aria-label"?: string; children: React.ReactNode }

export type ToggleButtonProps = Omit<
  AriaToggleButtonProps,
  "className" | "children" | "aria-label"
> &
  Nome & {
    icon: Icon
    variant?: "quiet" | "secondary"
    className?: string
  }

const VARIANT = {
  quiet:
    "bg-transparent text-ink data-hovered:bg-sunken data-pressed:bg-sunken data-selected:bg-primary-soft",
  secondary:
    "bg-surface text-ink border border-line-strong data-hovered:bg-raised data-pressed:bg-sunken data-selected:border-primary data-selected:bg-primary-soft",
} as const

export function ToggleButton({
  icon: Glyph,
  variant = "quiet",
  className,
  children,
  ...props
}: ToggleButtonProps) {
  return (
    <AriaToggleButton
      {...props}
      className={cx(
        "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-pill px-3 font-body text-sm font-medium",
        "transition-[transform,background-color,border-color] duration-[var(--ritu-fast)] ease-ritu",
        "data-pressed:scale-[0.98] data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus data-disabled:cursor-not-allowed data-disabled:opacity-50",
        VARIANT[variant],
        className,
      )}
    >
      {({ isSelected }) => (
        <>
          <Glyph weight={isSelected ? "fill" : "light"} size={ICON.lg} aria-hidden="true" />
          {children}
        </>
      )}
    </AriaToggleButton>
  )
}
