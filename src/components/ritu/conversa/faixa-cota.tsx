import { config } from "@config/index"
import { Hourglass } from "@phosphor-icons/react/ssr"
import { ICON } from "@/components/base/icon-size"

export function FaixaDeCota({ voltaAs }: { voltaAs: string }) {
  const { faixa, rotulo } = config.textosLimites.cota
  return (
    <aside
      aria-label={rotulo}
      className="flex items-start gap-3 rounded-lg bg-amber-soft p-3 font-body text-sm text-amber-ink"
    >
      <Hourglass weight="light" size={ICON.md} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">{faixa.replace("{hora}", voltaAs)}</p>
    </aside>
  )
}
