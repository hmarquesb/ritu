import { Drop, Fire, Wind } from "@phosphor-icons/react/dist/ssr"
import type { ReactElement } from "react"
import { cx } from "@/components/cx"

export type Dosha = "vata" | "pitta" | "kapha"

type BlotSize = "sm" | "md" | "lg"

const BOX: Record<BlotSize, string> = {
  sm: "size-16",
  md: "size-32",
  lg: "size-44",
}

const ICON_PX: Record<BlotSize, number> = { sm: 28, md: 56, lg: 80 }

const ICONS = { vata: Wind, pitta: Fire, kapha: Drop } as const

export function DoshaBlot(props: {
  dosha: Dosha
  size?: BlotSize
  withIcon?: boolean
  className?: string
}): ReactElement {
  const { dosha, size = "md", withIcon = true, className } = props
  const Icon = ICONS[dosha]
  return (
    <span
      aria-hidden="true"
      className={cx("relative inline-flex items-center justify-center", BOX[size], className)}
    >
      <img
        src={`/marca/mancha-${dosha}.webp`}
        alt=""
        className="absolute inset-0 size-full object-contain"
      />
      {withIcon ? (
        <Icon weight="thin" size={ICON_PX[size]} className="relative text-paper-ink" />
      ) : null}
    </span>
  )
}
