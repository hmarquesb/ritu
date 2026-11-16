import type { ComponentPropsWithoutRef, ElementType } from "react"
import { cx } from "@/components/cx"

export type SurfaceTone = "surface" | "raised" | "sunken" | "paper"
export type SurfaceRadius = "md" | "lg" | "card"
export type SurfacePadding = "none" | "sm" | "md" | "lg"
export type SurfaceShadow = "none" | "soft" | "lift"

export type SurfaceProps<T extends ElementType = "div"> = {
  as?: T
  tone?: SurfaceTone
  radius?: SurfaceRadius
  padding?: SurfacePadding
  shadow?: SurfaceShadow
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">

const TONE: Record<SurfaceTone, string> = {
  surface: "bg-surface text-ink",
  raised: "bg-raised text-ink",
  sunken: "bg-sunken text-ink",
  paper: "bg-paper text-paper-ink",
}
const RADIUS: Record<SurfaceRadius, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  card: "rounded-card",
}
const PADDING: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
}
const SHADOW: Record<SurfaceShadow, string> = {
  none: "",
  soft: "shadow-soft",
  lift: "shadow-lift",
}

export function Surface<T extends ElementType = "div">({
  as,
  tone = "surface",
  radius = "lg",
  padding = "md",
  shadow = "none",
  className,
  ...props
}: SurfaceProps<T>) {
  const Component: ElementType = as ?? "div"
  return (
    <Component
      {...props}
      className={cx(TONE[tone], RADIUS[radius], PADDING[padding], SHADOW[shadow], className)}
    />
  )
}
