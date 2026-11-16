"use client"

import type { ReactElement } from "react"
import { ToggleButton, ToggleButtonGroup } from "react-aria-components"
import { type ThemeChoice, themeCookie } from "@/components/theme/theme"

const OPTIONS: ReadonlyArray<{ id: ThemeChoice; label: string }> = [
  { id: "light", label: "Claro" },
  { id: "dark", label: "Escuro" },
  { id: "auto", label: "Automático" },
]

function apply(choice: ThemeChoice): void {
  // biome-ignore lint/suspicious/noDocumentCookie: cookie simples, sem Cookie Store (contrato)
  document.cookie = themeCookie(choice)
  const root = document.documentElement
  if (choice === "auto") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", choice)
}

export function ThemeSwitcher(props: { initial: ThemeChoice }): ReactElement {
  return (
    <ToggleButtonGroup
      aria-label="Tema"
      selectionMode="single"
      disallowEmptySelection
      defaultSelectedKeys={[props.initial]}
      onSelectionChange={(keys) => {
        const [first] = Array.from(keys)
        if (first === "light" || first === "dark" || first === "auto") apply(first)
      }}
      className="inline-flex gap-1 rounded-pill border border-line bg-raised p-1"
    >
      {OPTIONS.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-pill border border-transparent px-4 text-sm font-normal text-ink transition-colors data-[selected]:border-primary data-[selected]:bg-primary-soft data-[selected]:font-semibold motion-reduce:transition-none"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
