"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Check, ShoppingBag } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { ICON } from "@/components/base/icon-size"
import type { ItemDaListaNaTela } from "@/core/pantry/visao"
import type { CasaEmUso } from "./use-casa"

const T = config.textosCasa.lista

type Props = {
  itens: ItemDaListaNaTela[]
  pendente: CasaEmUso["pendente"]
  tocar: CasaEmUso["tocar"]
  lista: CasaEmUso["lista"]
}

export function ListaParaTer({ itens, pendente, tocar, lista }: Props) {
  return (
    <section aria-labelledby="casa-lista-titulo" className="flex flex-col gap-2">
      <h2
        id="casa-lista-titulo"
        tabIndex={-1}
        className="flex items-center gap-2 font-title text-title-sm font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ShoppingBag weight="light" size={ICON.lg} aria-hidden="true" />
        {T.titulo}
      </h2>
      {itens.length === 0 ? (
        <p className="text-body text-ink-muted">{T.vazia}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line border-y border-line p-0">
          {itens.map((item) => (
            <li key={item.alimento_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-ink">{item.nome}</p>
                <p className="text-sm text-ink-muted">{item.texto}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Check}
                  aria-label={formatar(T.rotuloComprei, { item: item.nome })}
                  isPending={pendente === `adicionar:${item.alimento_id}`}
                  onPress={() => tocar({ acao: "adicionar", alimento_id: item.alimento_id })}
                >
                  {T.comprei}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={formatar(T.rotuloTirar, { item: item.nome })}
                  isPending={pendente === `lista-tirar:${item.alimento_id}`}
                  onPress={() => lista("tirar", item.alimento_id)}
                >
                  {T.tirar}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
