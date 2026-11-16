import type { ReactElement } from "react"
import type { ThemeChoice } from "@/components/theme/theme"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"

export function SecaoTema(props: { initial: ThemeChoice }): ReactElement {
  return (
    <section aria-labelledby="marca-tema" className="flex flex-col items-start gap-6">
      <h2 id="marca-tema" className="font-title text-title font-semibold text-ink">
        Tema
      </h2>
      <p className="max-w-prose text-prose text-ink-muted">
        Claro, escuro ou o do aparelho. A escolha fica salva neste navegador.
      </p>
      <ThemeSwitcher initial={props.initial} />
    </section>
  )
}
