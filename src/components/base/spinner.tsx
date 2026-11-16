"use client"

import { cx } from "@/components/cx"

export interface SpinnerProps {
  /** Texto para leitor de tela. */
  label: string
  className?: string
}

const DELAYS = ["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"]

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span role="status" className={cx("inline-flex items-center gap-1", className)}>
      {DELAYS.map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          className={cx(
            "size-1.5 rounded-pill bg-current animate-fade [animation-direction:alternate] [animation-duration:700ms] [animation-iteration-count:infinite]",
            delay,
          )}
        />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  )
}
