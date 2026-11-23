"use client"

import { textosBastidores } from "@config/index"
import { CaretDown } from "@phosphor-icons/react"
import { Button, Disclosure, DisclosurePanel } from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { dataCurta } from "@/components/ritu/bastidores/datas"

export type TabelaPronta = {
  checkpoints: { checkpoint: string; curto: string; data: string }[]
  grupos: {
    familia: string
    rotulo: string
    linhas: { id: string; rotulo: string; celulas: { texto: string; abaixo: boolean }[] }[]
  }[]
}

const T = textosBastidores.evals

function Celula({ texto, abaixo }: { texto: string; abaixo: boolean }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">
      {abaixo ? (
        <span className="text-amber-ink">
          <span aria-hidden="true">⚠ </span>
          {texto}
          <span className="sr-only"> {T.abaixo}</span>
        </span>
      ) : (
        texto
      )}
    </td>
  )
}

/** "Todas as métricas": tabela recolhida, uma coluna por checkpoint e uma linha por métrica. */
export function TabelaMetricas({ tabela }: { tabela: TabelaPronta }) {
  const colunas = tabela.checkpoints.length + 1
  return (
    <Disclosure className="group rounded-lg border border-line bg-surface">
      <h3 className="m-0">
        <Button
          slot="trigger"
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-left font-title text-title-sm font-semibold text-ink outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
        >
          {T.todas}
          <CaretDown
            weight="light"
            size={ICON.lg}
            aria-hidden="true"
            className="shrink-0 transition-transform duration-[var(--ritu-fast)] ease-ritu group-data-expanded:rotate-180"
          />
        </Button>
      </h3>
      <DisclosurePanel>
        <section
          aria-label={T.todas}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a área rola na horizontal e precisa de foco por teclado
          tabIndex={0}
          className="overflow-x-auto rounded-b-lg border-t border-line outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="px-4 py-3 text-left text-sm text-ink-muted">{T.legenda}</caption>
            <thead>
              <tr className="bg-sunken">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-sunken px-4 py-2 text-left font-medium text-ink"
                >
                  Métrica
                </th>
                {tabela.checkpoints.map((c) => (
                  <th
                    key={c.checkpoint}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-right font-medium text-ink"
                  >
                    {c.curto}
                    <span className="block text-caption font-normal text-ink-muted">
                      {dataCurta(c.data)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            {tabela.grupos.map((grupo) => (
              <tbody key={grupo.familia} className="border-t border-line">
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={colunas}
                    className="sticky left-0 bg-surface px-4 pb-1 pt-4 text-left font-title text-title-sm font-semibold text-ink"
                  >
                    {grupo.rotulo}
                  </th>
                </tr>
                {grupo.linhas.map((linha) => (
                  <tr key={linha.id} className="border-t border-line">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal text-ink"
                    >
                      {linha.rotulo}
                    </th>
                    {linha.celulas.map((c, i) => (
                      <Celula
                        key={tabela.checkpoints[i]?.checkpoint ?? i}
                        texto={c.texto}
                        abaixo={c.abaixo}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </section>
      </DisclosurePanel>
    </Disclosure>
  )
}
