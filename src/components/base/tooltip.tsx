"use client"

import { config } from "@config/index"
import type { ReactElement } from "react"
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components"
import { cx } from "@/components/cx"

export interface TooltipProps {
  text: string
  children: ReactElement
  className?: string
}

export function Tooltip({ text, children, className }: TooltipProps) {
  return (
    <TooltipTrigger delay={config.ui.tooltip.delayMs}>
      {children}
      <AriaTooltip
        offset={8}
        className={cx(
          "max-w-64 rounded-sm bg-raised px-3 py-1.5 text-caption text-ink shadow-lift animate-fade",
          className,
        )}
      >
        {text}
      </AriaTooltip>
    </TooltipTrigger>
  )
}
