import type { ReactElement } from "react"
import { Surface } from "@/components/base/surface"
import { DoshaBlot } from "@/components/brand/dosha-blot"
import { Logo } from "@/components/brand/logo"

const DOSHAS = [
  { dosha: "vata", name: "Vata" },
  { dosha: "pitta", name: "Pitta" },
  { dosha: "kapha", name: "Kapha" },
] as const

export function SecaoMarca(): ReactElement {
  return (
    <section aria-labelledby="marca-marca" className="flex flex-col gap-6">
      <h2 id="marca-marca" className="font-title text-title font-semibold text-ink">
        Marca
      </h2>
      <div className="flex flex-wrap items-center gap-8 text-ink">
        <Logo variant="symbol" size="lg" />
        <Logo variant="full" size="lg" />
      </div>
      <h3 className="font-title text-title-sm font-semibold text-ink">Manchas dos doshas</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4">
        {DOSHAS.map((item) => (
          <Surface
            key={item.dosha}
            tone="paper"
            radius="card"
            shadow="soft"
            className="flex flex-col items-center gap-2"
          >
            <DoshaBlot dosha={item.dosha} size="md" />
            <p className="font-title text-title-sm font-semibold">{item.name}</p>
          </Surface>
        ))}
      </div>
    </section>
  )
}
