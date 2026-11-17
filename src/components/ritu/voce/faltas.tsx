"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Trash } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import { chaveDoToque, type VoceEmUso } from "./use-voce"

const T = config.textosVoce

type Props = { faltas: MemoriaNaTela["faltas"]; em: VoceEmUso }

export function FaltasNaMemoria({ faltas, em }: Props) {
  return (
    <NivelDaMemoria
      id="faltas"
      titulo={T.nivel.faltas.titulo}
      como={T.nivel.faltas.como}
      vazio={faltas.length === 0 ? T.nivel.faltas.vazio : null}
    >
      <ListaDeMemoria>
        {faltas.map((f) => {
          const apagar = { acao: "falta_apagar", alimento_id: f.alimento_id } as const
          const linha = f.dias === 1 ? T.faltas.linhaUmDia : formatar(T.faltas.linha, { n: f.dias })
          return (
            <ItemDeMemoria
              key={f.alimento_id}
              principal={f.nome}
              complemento={f.na_lista ? `${linha} · ${T.faltas.naLista}` : linha}
              acoes={
                <Button
                  variant="quiet"
                  size="sm"
                  icon={Trash}
                  aria-label={`${T.apagar}: ${f.nome}`}
                  isPending={em.pendente === chaveDoToque(apagar)}
                  onPress={async () => {
                    if (await em.memoria(apagar)) focarNivel("faltas")
                  }}
                >
                  {T.apagar}
                </Button>
              }
            />
          )
        })}
      </ListaDeMemoria>
    </NivelDaMemoria>
  )
}
