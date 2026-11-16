import type { ReactElement } from "react"

const SIZES: ReadonlyArray<{ name: string; classes: string; sample: string }> = [
  { name: "caption · 13", classes: "text-caption", sample: "Atualizado agora há pouco" },
  { name: "sm · 14", classes: "text-sm", sample: "Gengibre, canela, mel" },
  { name: "body · 16", classes: "text-body", sample: "O que você tem em casa hoje?" },
  { name: "prose · 17", classes: "text-prose", sample: "Um caldo morno para o fim do dia" },
  {
    name: "title-sm · 22",
    classes: "font-title text-title-sm font-semibold",
    sample: "Para esta noite fria",
  },
  {
    name: "title · 28",
    classes: "font-title text-title font-semibold",
    sample: "Seu dia, do seu jeito",
  },
  {
    name: "display · 36",
    classes: "font-title text-display font-medium",
    sample: "Ritu",
  },
]

export function SecaoTipografia(): ReactElement {
  return (
    <section aria-labelledby="marca-tipografia" className="flex flex-col gap-6">
      <h2 id="marca-tipografia" className="font-title text-title font-semibold text-ink">
        Tipografia
      </h2>
      <p className="max-w-prose text-prose text-ink-muted">
        Cormorant Garamond nos títulos, a partir de title-sm, nunca em texto corrido. Figtree em
        todo o resto.
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {SIZES.map((size) => (
          <li
            key={size.name}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <code className="w-32 shrink-0 text-caption text-ink-muted">{size.name}</code>
            <span className={`text-ink ${size.classes}`}>{size.sample}</span>
          </li>
        ))}
      </ul>
      <h3 className="font-title text-title-sm font-semibold text-ink">Fala do agente</h3>
      <p className="max-w-prose text-prose text-ink">
        Um chá de gengibre com canela agora, que o dia esfriou. Se tiver mel em casa, uma colher
        pequena ajuda a suavizar. Depois, uma caminhada curta e uma refeição quente e simples fecham
        bem a tarde.
      </p>
    </section>
  )
}
