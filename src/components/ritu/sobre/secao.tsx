import type { ReactNode } from "react"

/** Seção do Sobre: `section` nomeada pelo `h2`, com folga para a âncora. */
export function SecaoDoSobre({
  id,
  titulo,
  children,
}: {
  id: string
  titulo: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="flex scroll-mt-6 flex-col gap-4 border-t border-line pt-8"
    >
      <h2 id={`${id}-titulo`} className="font-title text-title font-semibold text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/** Texto em parágrafos: "\n\n" separa. */
export function Paragrafos({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n\n").map((p) => (
        <p key={p} className="max-w-prose text-prose text-ink">
          {p}
        </p>
      ))}
    </>
  )
}
