import { cx } from "@/components/cx"

export type FalaProps = { texto: string; className?: string }

export function FalaDaPessoa({ texto, className }: FalaProps) {
  return (
    <div className={cx("flex justify-end", className)}>
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-sunken px-4 py-2.5 font-body text-body text-ink">
        {texto}
      </p>
    </div>
  )
}

function paragrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function FalaDoAgente({ texto, className }: FalaProps) {
  return (
    <div
      className={cx(
        "flex max-w-[38rem] flex-col gap-3 font-body text-body leading-[1.6] text-ink motion-safe:animate-fade",
        className,
      )}
    >
      {paragrafos(texto).map((p, i) => (
        <p key={i} className="whitespace-pre-wrap break-words">
          {p}
        </p>
      ))}
    </div>
  )
}
