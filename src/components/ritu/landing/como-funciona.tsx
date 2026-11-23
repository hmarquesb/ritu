import { textosLanding } from "@config/index"

const T = textosLanding.como
const PASSOS = [T[1], T[2], T[3]] as const

export function ComoFunciona() {
  return (
    <section aria-labelledby="como-funciona" className="flex flex-col gap-8">
      <h2 id="como-funciona" tabIndex={-1} className="font-title text-title text-ink outline-none">
        {T.titulo}
      </h2>
      <ol className="grid gap-8 min-[48rem]:grid-cols-3 min-[48rem]:gap-6">
        {PASSOS.map((passo, i) => (
          <li key={passo.titulo} className="flex flex-col gap-2">
            <span aria-hidden="true" className="font-title text-display text-primary">
              {i + 1}
            </span>
            <h3 className="font-title text-title-sm text-ink">{passo.titulo}</h3>
            <p className="text-body text-ink-muted">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
