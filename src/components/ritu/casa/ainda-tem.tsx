"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Question } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { ICON } from "@/components/base/icon-size"
import { Surface } from "@/components/base/surface"
import type { ItemNaCasa } from "@/core/pantry/visao"
import type { CasaEmUso } from "./use-casa"

const T = config.textosCasa.aindaTem

type Props = {
  itens: ItemNaCasa[]
  pendente: CasaEmUso["pendente"]
  tocar: CasaEmUso["tocar"]
  onTocou: (item: ItemNaCasa, casa: Awaited<ReturnType<CasaEmUso["tocar"]>>) => void
}

function minusculo(nome: string): string {
  return nome.toLocaleLowerCase("pt-BR")
}

export function AindaTem({ itens, pendente, tocar, onTocou }: Props) {
  if (itens.length === 0) return null
  return (
    <Surface as="section" tone="sunken" padding="md" aria-labelledby="casa-ainda-tem-titulo">
      <h2
        id="casa-ainda-tem-titulo"
        tabIndex={-1}
        className="flex items-center gap-2 font-title text-title-sm font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Question weight="light" size={ICON.lg} aria-hidden="true" />
        {T.titulo}
      </h2>
      <p className="mt-1 text-body text-ink-muted">{T.texto}</p>
      <ul className="m-0 mt-3 flex list-none flex-col divide-y divide-line p-0">
        {itens.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-ink">{item.nome}</p>
              <p className="text-sm text-ink-muted">
                {formatar(config.textosCasa.estado.dias, { n: item.dias })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label={formatar(T.rotuloTenho, { item: minusculo(item.nome) })}
                isPending={pendente === `tenho:${item.id}`}
                onPress={async () =>
                  onTocou(item, await tocar({ acao: "tenho", item_id: item.id }))
                }
              >
                {T.tenho}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                aria-label={formatar(T.rotuloAcabou, { Item: item.nome })}
                isPending={pendente === `acabou:${item.id}`}
                onPress={async () =>
                  onTocou(item, await tocar({ acao: "acabou", item_id: item.id }))
                }
              >
                {T.acabou}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  )
}
