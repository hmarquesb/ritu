import type { ReactElement } from "react"
import { cx } from "@/components/cx"

type LogoSize = "sm" | "md" | "lg"

const SYMBOL_SIZE: Record<LogoSize, string> = {
  sm: "size-8",
  md: "size-12",
  lg: "size-24",
}

const WORD_SIZE: Record<LogoSize, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
}

const MASK = {
  maskImage: "url(/marca/simbolo-ritu.png)",
  WebkitMaskImage: "url(/marca/simbolo-ritu.png)",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  backgroundColor: "currentColor",
} as const

export function Logo(props: {
  variant?: "symbol" | "full"
  size?: LogoSize
  className?: string
}): ReactElement {
  const { variant = "symbol", size = "md", className } = props
  const symbolClass = cx("inline-block shrink-0", SYMBOL_SIZE[size])
  if (variant === "symbol") {
    return <span role="img" aria-label="Ritu" className={cx(symbolClass, className)} style={MASK} />
  }
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className={symbolClass} style={MASK} />
      <span className={cx("font-title font-medium leading-none", WORD_SIZE[size])}>Ritu</span>
    </span>
  )
}
