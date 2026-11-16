import type { ReactNode } from "react"

export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6">
      <h3 className="font-title text-title-sm text-ink">{titulo}</h3>
      {children}
    </div>
  )
}

export function Linha({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
