import { textosLanding } from "@config/index"
import { Check, Prohibit } from "@phosphor-icons/react/dist/ssr"
import { ICON } from "@/components/base/icon-size"

function Lista({
  titulo,
  itens,
  Glyph,
  id,
}: {
  titulo: string
  itens: readonly string[]
  Glyph: typeof Check
  id: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 id={id} className="font-title text-title-sm text-ink">
        {titulo}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item} className="flex items-start gap-3 text-body text-ink">
            <Glyph
              weight="light"
              size={ICON.md}
              aria-hidden="true"
              className="mt-1 shrink-0 text-primary"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FazENaoFaz() {
  const { faz, naoFaz } = textosLanding
  return (
    <section aria-labelledby="faz-nao-faz" className="flex flex-col gap-8">
      <h2 id="faz-nao-faz" className="font-title text-title text-ink">
        {faz.titulo} / {naoFaz.titulo}
      </h2>
      <div className="grid gap-8 min-[48rem]:grid-cols-2 min-[48rem]:gap-10">
        <Lista id="faz-lista" titulo={faz.titulo} itens={faz.itens} Glyph={Check} />
        <Lista id="nao-faz-lista" titulo={naoFaz.titulo} itens={naoFaz.itens} Glyph={Prohibit} />
      </div>
    </section>
  )
}
