import { CookingPot, Drop, Fire, Leaf, Wind } from "@phosphor-icons/react/dist/ssr"
import type { ReactElement } from "react"
import { ICON } from "@/components/base/icon-size"

const SIZES = [
  { name: "sm", px: ICON.sm, weight: "light" },
  { name: "md", px: ICON.md, weight: "light" },
  { name: "lg", px: ICON.lg, weight: "light" },
  { name: "xl", px: ICON.xl, weight: "thin" },
] as const

const GLYPHS = [CookingPot, Leaf, Fire, Wind, Drop] as const

export function SecaoIcones(): ReactElement {
  return (
    <section aria-labelledby="marca-icones" className="flex flex-col gap-6">
      <h2 id="marca-icones" className="font-title text-title font-semibold text-ink">
        Ícones
      </h2>
      <p className="max-w-prose text-prose text-ink-muted">
        Phosphor em traço fino: peso light até 24 px, thin no tamanho grande.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
        {SIZES.map((size) => (
          <li
            key={size.name}
            className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
          >
            <span className="flex items-center gap-2 text-ink">
              {GLYPHS.map((Glyph) => (
                <Glyph
                  key={Glyph.displayName ?? Glyph.name}
                  size={size.px}
                  weight={size.weight}
                  aria-hidden="true"
                />
              ))}
            </span>
            <code className="text-caption text-ink-muted">
              {size.name} · {size.px} px · {size.weight}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}
