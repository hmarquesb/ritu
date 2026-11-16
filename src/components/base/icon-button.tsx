"use client"

import type { Icon } from "@phosphor-icons/react"
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

export interface IconButtonProps extends Omit<AriaButtonProps, "className" | "children"> {
  icon: Icon
  "aria-label": string
  variant?: "quiet" | "secondary"
  size?: "md" | "sm"
  className?: string
}

const VARIANT = {
  quiet: "bg-transparent text-ink data-hovered:bg-sunken data-pressed:bg-sunken",
  secondary:
    "bg-surface text-ink border border-line-strong data-hovered:bg-raised data-pressed:bg-sunken",
} as const

// `sm`: 2.25rem visuais; a área de toque (3rem, para cobrir os 2.75rem mesmo com borda) vem do pseudo-elemento.
const SIZE = {
  md: "size-11",
  sm: "relative size-9 after:absolute after:-inset-1.5 after:content-['']",
} as const

export function IconButton({
  icon: IconComponent,
  variant = "quiet",
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <AriaButton
      {...props}
      className={cx(
        "inline-flex min-h-9 shrink-0 items-center justify-center rounded-pill cursor-pointer select-none",
        "transition-[transform,background-color] duration-[var(--ritu-fast)] ease-ritu",
        "data-pressed:scale-[0.98] data-disabled:opacity-50 data-disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      <IconComponent weight="light" size={size === "sm" ? ICON.md : ICON.lg} aria-hidden="true" />
    </AriaButton>
  )
}
