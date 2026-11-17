"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Eraser } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { ToggleChip } from "@/components/base/chip"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import { chaveDoToque, type VoceEmUso } from "./use-voce"

const T = config.textosVoce
const C = config.textosCasa.folha

type Linha = MemoriaNaTela["gostos"][number]

function contagem(n: number, uma: string, varias: string): string | null {
  if (n === 0) return null
  return n === 1 ? uma : formatar(varias, { n })
}

function complemento(g: Linha): string {
  const partes = [
    T.gostos.tipo[g.item_tipo],
    g.gosto === "gosta" ? T.gostos.gosta : null,
    g.gosto === "nao_gosta" ? T.gostos.naoGosta : null,
    contagem(g.ajudou, T.gostos.ajudouUma, T.gostos.ajudou),
    contagem(g.nao_ajudou, T.gostos.naoAjudouUma, T.gostos.naoAjudou),
    contagem(g.nao_fez, T.gostos.naoFezUma, T.gostos.naoFez),
  ]
  return partes.filter((p): p is string => p !== null).join(" · ")
}

// O toque no chip grava `gosto: <valor>` ao marcar e `gosto: null` ao desmarcar: a ação
// serve ao `onChange` e à chave do pendente.
function acaoDoGosto(g: Linha, valor: "gosta" | "nao_gosta") {
  const gosto = g.gosto === valor ? null : valor
  return { acao: "gosto", item_tipo: g.item_tipo, item_id: g.item_id, gosto } as const
}

const chaveGosto = (g: Linha, valor: "gosta" | "nao_gosta") => chaveDoToque(acaoDoGosto(g, valor))

type Props = { gostos: Linha[]; em: VoceEmUso }

export function GostosNaMemoria({ gostos, em }: Props) {
  const { memoria, pendente } = em
  const base = (g: Linha) => ({ item_tipo: g.item_tipo, item_id: g.item_id })
  return (
    <NivelDaMemoria
      id="gostos"
      titulo={T.nivel.gostos.titulo}
      como={T.nivel.gostos.como}
      vazio={gostos.length === 0 ? T.nivel.gostos.vazio : null}
    >
      <ListaDeMemoria>
        {gostos.map((g) => {
          const esquecer = { acao: "esquecer", ...base(g) } as const
          return (
            <ItemDeMemoria
              key={`${g.item_tipo}:${g.item_id}`}
              principal={g.nome}
              complemento={complemento(g)}
              acoes={
                <>
                  <ToggleChip
                    aria-label={`${C.gosto}: ${g.nome}`}
                    isSelected={g.gosto === "gosta"}
                    isPending={pendente === chaveGosto(g, "gosta")}
                    onChange={() => memoria(acaoDoGosto(g, "gosta"))}
                  >
                    {C.gosto}
                  </ToggleChip>
                  <ToggleChip
                    aria-label={`${C.naoGosto}: ${g.nome}`}
                    isSelected={g.gosto === "nao_gosta"}
                    isPending={pendente === chaveGosto(g, "nao_gosta")}
                    onChange={() => memoria(acaoDoGosto(g, "nao_gosta"))}
                  >
                    {C.naoGosto}
                  </ToggleChip>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={Eraser}
                    aria-label={`${T.gostos.esquecer}: ${g.nome}`}
                    isPending={pendente === chaveDoToque(esquecer)}
                    onPress={async () => {
                      if (await memoria(esquecer)) focarNivel("gostos")
                    }}
                  >
                    {T.gostos.esquecer}
                  </Button>
                </>
              }
            />
          )
        })}
      </ListaDeMemoria>
    </NivelDaMemoria>
  )
}
