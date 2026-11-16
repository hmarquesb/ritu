import type { ReactElement } from "react"

const TOKENS: ReadonlyArray<{ name: string; swatch: string }> = [
  { name: "canvas", swatch: "bg-canvas" },
  { name: "sunken", swatch: "bg-sunken" },
  { name: "surface", swatch: "bg-surface" },
  { name: "raised", swatch: "bg-raised" },
  { name: "line", swatch: "bg-line" },
  { name: "line-strong", swatch: "bg-line-strong" },
  { name: "ink", swatch: "bg-ink" },
  { name: "ink-muted", swatch: "bg-ink-muted" },
  { name: "primary", swatch: "bg-primary" },
  { name: "primary-hover", swatch: "bg-primary-hover" },
  { name: "primary-pressed", swatch: "bg-primary-pressed" },
  { name: "on-primary", swatch: "bg-on-primary" },
  { name: "primary-soft", swatch: "bg-primary-soft" },
  { name: "amber", swatch: "bg-amber" },
  { name: "amber-ink", swatch: "bg-amber-ink" },
  { name: "amber-soft", swatch: "bg-amber-soft" },
  { name: "sage", swatch: "bg-sage" },
  { name: "sage-ink", swatch: "bg-sage-ink" },
  { name: "sage-soft", swatch: "bg-sage-soft" },
  { name: "danger", swatch: "bg-danger" },
  { name: "danger-soft", swatch: "bg-danger-soft" },
  { name: "focus", swatch: "bg-focus" },
  { name: "vata", swatch: "bg-vata" },
  { name: "pitta", swatch: "bg-pitta" },
  { name: "kapha", swatch: "bg-kapha" },
  { name: "paper", swatch: "bg-paper" },
  { name: "paper-ink", swatch: "bg-paper-ink" },
  { name: "scrim", swatch: "bg-scrim" },
  { name: "shadow", swatch: "bg-canvas shadow-lift" },
]

const PAIRS: ReadonlyArray<{ label: string; classes: string }> = [
  { label: "ink sobre canvas", classes: "text-ink bg-canvas" },
  { label: "ink sobre surface", classes: "text-ink bg-surface" },
  { label: "ink sobre raised", classes: "text-ink bg-raised" },
  { label: "ink sobre sunken", classes: "text-ink bg-sunken" },
  { label: "ink-muted sobre canvas", classes: "text-ink-muted bg-canvas" },
  { label: "ink-muted sobre sunken", classes: "text-ink-muted bg-sunken" },
  { label: "on-primary sobre primary", classes: "text-on-primary bg-primary" },
  { label: "ink sobre primary-soft", classes: "text-ink bg-primary-soft" },
  { label: "amber-ink sobre amber-soft", classes: "text-amber-ink bg-amber-soft" },
  { label: "sage-ink sobre sage-soft", classes: "text-sage-ink bg-sage-soft" },
  { label: "danger sobre danger-soft", classes: "text-danger bg-danger-soft" },
  { label: "paper-ink sobre paper", classes: "text-paper-ink bg-paper" },
]

export function SecaoCores(): ReactElement {
  return (
    <section aria-labelledby="marca-cores" className="flex flex-col gap-6">
      <h2 id="marca-cores" className="font-title text-title font-semibold text-ink">
        Cores
      </h2>
      <p className="max-w-prose text-prose text-ink-muted">
        Cada cor é um token que troca de valor entre o tema claro e o escuro. Nenhuma tela usa cor
        escrita à mão.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
        {TOKENS.map((token) => (
          <li key={token.name} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={`block h-14 rounded-md border border-line ${token.swatch}`}
            />
            <code className="break-words text-caption text-ink">{token.name}</code>
          </li>
        ))}
      </ul>
      <h3 className="font-title text-title-sm font-semibold text-ink">Pares de texto</h3>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {PAIRS.map((pair) => (
          <li
            key={pair.label}
            className={`rounded-md border border-line px-4 py-3 text-sm ${pair.classes}`}
          >
            {pair.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
