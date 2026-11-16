import type { Icon } from "@phosphor-icons/react"
import { CloudSlash, HourglassMedium, Leaf, WarningCircle } from "@phosphor-icons/react/ssr"
import type { ReactNode } from "react"
import { ICON } from "@/components/base/icon-size"
import { Spinner } from "@/components/base/spinner"
import { cx } from "@/components/cx"

export type StateKind = "loading" | "error" | "empty" | "waiting" | "quota"

export interface StateBlockProps {
  kind: StateKind
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

const ICONS: Record<Exclude<StateKind, "loading">, Icon> = {
  error: WarningCircle,
  empty: Leaf,
  waiting: HourglassMedium,
  quota: CloudSlash,
}

export function StateBlock({ kind, title, description, action, className }: StateBlockProps) {
  const role = kind === "loading" ? "status" : kind === "error" ? "alert" : undefined
  const Glyph = kind === "loading" ? null : ICONS[kind]
  return (
    <div
      role={role}
      className={cx(
        "flex flex-col items-center gap-3 rounded-lg bg-sunken px-6 py-8 text-center font-body",
        className,
      )}
    >
      <span
        className={cx(
          "flex size-12 items-center justify-center",
          kind === "error" ? "text-danger" : "text-ink-muted",
        )}
      >
        {Glyph ? (
          <Glyph weight="thin" size={ICON.xl} aria-hidden="true" />
        ) : (
          <span aria-hidden="true">
            <Spinner label={title} />
          </span>
        )}
      </span>
      <p className="text-balance font-title text-title-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-prose text-body text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
