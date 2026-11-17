"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { ItemNaCasa } from "@/core/pantry/visao"
import { ItemDaCasa } from "./item"

const T = config.textosCasa.prateleira

export function numeroDeItens(n: number): string {
  return n === 1 ? T.numeroUm : formatar(T.numero, { n })
}

type Props = {
  id: string
  nome: string
  itens: ItemNaCasa[]
  onAbrir: (id: string) => void
}

// A tábua: os rótulos assentam sobre uma linha de 1px, com meio rem de `sunken` embaixo.
export function Prateleira({ id, nome, itens, onAbrir }: Props) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-2">
      <h2
        id={`${id}-titulo`}
        tabIndex={-1}
        className="flex items-baseline gap-2 font-title text-title-sm font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {nome}
        <span className="font-body text-sm font-normal text-ink-muted">
          {numeroDeItens(itens.length)}
        </span>
      </h2>
      <div className="border-b border-line pb-2.5 shadow-[0_0.5rem_0_0_var(--ritu-sunken)]">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {itens.map((item) => (
            <li key={item.id}>
              <ItemDaCasa item={item} onAbrir={onAbrir} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
