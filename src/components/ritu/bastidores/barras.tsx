import { cx } from "@/components/cx"

export type ItemDeBarra = { rotulo: string; total: number; porcentagem?: number }

/** Lista de barras horizontais: o texto diz tudo, a barra só reforça. */
export function Barras({
  titulo,
  itens,
  className,
}: {
  titulo: string
  itens: ItemDeBarra[]
  className?: string
}) {
  const maior = Math.max(1, ...itens.map((i) => i.total))
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <h3 className="font-title text-title-sm font-semibold text-ink">{titulo}</h3>
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item.rotulo} className="flex flex-col gap-1.5">
            <p className="flex items-baseline justify-between gap-3 text-body text-ink">
              <span>{item.rotulo}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {item.total}
                {item.porcentagem === undefined ? "" : ` · ${item.porcentagem}%`}
              </span>
            </p>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-sunken">
              <div
                className="h-full rounded-pill bg-primary"
                style={{ width: `${Math.max(2, Math.round((item.total / maior) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
