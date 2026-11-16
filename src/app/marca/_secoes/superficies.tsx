import type { ReactElement } from "react"
import {
  Surface,
  type SurfaceRadius,
  type SurfaceShadow,
  type SurfaceTone,
} from "@/components/base/surface"

const TONES: ReadonlyArray<{ tone: SurfaceTone; text: string }> = [
  { tone: "surface", text: "Fala e blocos do dia a dia" },
  { tone: "raised", text: "Cartões que sobem sobre o fundo" },
  { tone: "sunken", text: "Áreas rebaixadas, como estados" },
  { tone: "paper", text: "Papel das cartas de dosha" },
]
const RADII: SurfaceRadius[] = ["md", "lg", "card"]
const SHADOWS: SurfaceShadow[] = ["soft", "lift"]

export function SecaoSuperficies(): ReactElement {
  return (
    <section aria-labelledby="marca-superficies" className="flex flex-col gap-6">
      <h2 id="marca-superficies" className="font-title text-title font-semibold text-ink">
        Superfícies
      </h2>
      <h3 className="font-title text-title-sm font-semibold text-ink">Tons</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
        {TONES.map((item) => (
          <Surface key={item.tone} tone={item.tone} className="border border-line">
            <code className="text-caption">{item.tone}</code>
            <p className="mt-1 text-sm">{item.text}</p>
          </Surface>
        ))}
      </div>
      <h3 className="font-title text-title-sm font-semibold text-ink">Raios</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
        {RADII.map((radius) => (
          <Surface key={radius} tone="raised" radius={radius} className="border border-line">
            <code className="text-caption">{radius}</code>
          </Surface>
        ))}
      </div>
      <h3 className="font-title text-title-sm font-semibold text-ink">Sombras</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4">
        {SHADOWS.map((shadow) => (
          <Surface key={shadow} tone="raised" shadow={shadow}>
            <code className="text-caption">{shadow}</code>
          </Surface>
        ))}
      </div>
    </section>
  )
}
