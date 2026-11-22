"use client"

import type { ReactNode } from "react"

type Props = {
  /** Chave do nível; o `h3` leva o id `voce-<id>-titulo`. */
  id: string
  titulo: string
  /** Como o que está aqui foi anotado. */
  como: string
  /** Texto do nível sem itens; `null` quando há itens. */
  vazio: string | null
  children?: ReactNode
  /** Texto fixo depois dos itens ou do vazio. */
  rodape?: ReactNode
}

export const idDoTitulo = (id: string) => `voce-${id}-titulo`

// O item saiu da lista: o foco vai para o `h3` do nível, depois que a folha ou o diálogo fecharem.
export function focarNivel(id: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.getElementById(idDoTitulo(id))?.focus())
  })
}

// Caderno: no desktop, a margem (título e "como") fica à esquerda; no celular, um fio à esquerda do bloco.
export function NivelDaMemoria({ id, titulo, como, vazio, children, rodape }: Props) {
  const tituloId = idDoTitulo(id)
  return (
    <section
      aria-labelledby={tituloId}
      className="flex flex-col gap-3 border-l border-line pl-4 md:grid md:grid-cols-[11rem_1fr] md:gap-0 md:border-l-0 md:pl-0"
    >
      <div className="md:pr-6">
        <h3
          id={tituloId}
          tabIndex={-1}
          className="font-title text-xl font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {titulo}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">{como}</p>
      </div>
      <div className="min-w-0 md:border-l md:border-line md:pl-6">
        {vazio !== null ? <p className="text-body text-ink-muted">{vazio}</p> : children}
        {rodape}
      </div>
    </section>
  )
}
