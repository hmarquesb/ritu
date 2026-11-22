"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { TextLink } from "@/components/base/text-link"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { NivelDaMemoria } from "./nivel"

const T = config.textosVoce

function resumo(casa: MemoriaNaTela["casa"]): string {
  const partes = [
    casa.itens === 1 ? T.casa.resumo.umItem : formatar(T.casa.resumo.itens, { n: casa.itens }),
    formatar(T.casa.resumo.incertos, { incertos: casa.incertos }),
    formatar(T.casa.resumo.acabaram, { acabou: casa.acabou }),
  ]
  if (casa.na_lista > 0) partes.push(formatar(T.casa.lista, { n: casa.na_lista }))
  return partes.join(" · ")
}

export function CasaNaMemoria({ casa }: { casa: MemoriaNaTela["casa"] }) {
  const vazia = casa.itens === 0 && casa.acabou === 0 && casa.na_lista === 0
  return (
    <NivelDaMemoria
      id="casa"
      titulo={T.nivel.casa.titulo}
      como={T.nivel.casa.como}
      vazio={vazia ? T.nivel.casa.vazio : null}
    >
      <p className="text-body text-ink">{resumo(casa)}</p>
      <p className="mt-2">
        <TextLink href="/casa">{T.casa.link}</TextLink>
      </p>
    </NivelDaMemoria>
  )
}
