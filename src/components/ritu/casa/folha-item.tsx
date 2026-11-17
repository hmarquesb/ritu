"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Button } from "@/components/base/button"
import { ToggleChip } from "@/components/base/chip"
import { Sheet } from "@/components/base/dialog"
import { Switch } from "@/components/base/switch"
import type { CasaNaTela, ItemNaCasa } from "@/core/pantry/visao"
import type { CasaEmUso } from "./use-casa"

const T = config.textosCasa

export function linhaDeEstado(item: ItemNaCasa): string {
  const estado = T.estado
  if (item.estado === "acabou") return estado.acabou
  if (item.estado === "sempre_tenho") return estado.sempre
  if (item.dias <= 0) return estado.hoje
  if (item.dias === 1) return estado.ontem
  return formatar(estado.dias, { n: item.dias })
}

type Props = {
  item: ItemNaCasa | undefined
  pendente: CasaEmUso["pendente"]
  tocar: CasaEmUso["tocar"]
  gostar: CasaEmUso["gostar"]
  lista: CasaEmUso["lista"]
  onFechar: () => void
  // Chamada quando o toque mudou a casa; a tela decide para onde vai o foco.
  onMudou: (item: ItemNaCasa, casa: CasaNaTela | undefined) => void
}

export function FolhaDoItem({ item, onFechar, ...resto }: Props) {
  return (
    <Sheet
      title={item?.nome ?? ""}
      isOpen={item !== undefined}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar()
      }}
    >
      {item ? <Conteudo item={item} {...resto} /> : null}
    </Sheet>
  )
}

type ConteudoProps = Omit<Props, "item" | "onFechar"> & { item: ItemNaCasa }

function Conteudo({ item, pendente, tocar, gostar, lista, onMudou }: ConteudoProps) {
  const ocupado = pendente !== null
  const emCasa = item.estado !== "acabou"
  const alimento = item.alimento_id
  const aMudar = async (promessa: Promise<CasaNaTela | undefined>) => onMudou(item, await promessa)
  const botao = (chave: string) => ({
    isPending: pendente === chave,
    isDisabled: ocupado && pendente !== chave,
  })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">{linhaDeEstado(item)}</p>
      {item.grupo === null ? (
        <p className="text-sm text-ink-muted">{T.estado.desconhecido}</p>
      ) : null}

      {emCasa ? (
        <Switch
          isSelected={item.sempre_tenho}
          isDisabled={ocupado}
          onChange={(valor) => tocar({ acao: "sempre_tenho", item_id: item.id, valor })}
        >
          {T.folha.sempre}
        </Switch>
      ) : null}

      {item.grupo !== null && alimento !== null ? (
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{item.nome}</legend>
          <ToggleChip
            isSelected={item.gosto === "gosta"}
            isDisabled={ocupado}
            onChange={(marcado) => gostar(alimento, marcado ? "gosta" : null)}
          >
            {T.folha.gosto}
          </ToggleChip>
          <ToggleChip
            isSelected={item.gosto === "nao_gosta"}
            isDisabled={ocupado}
            onChange={(marcado) => gostar(alimento, marcado ? "nao_gosta" : null)}
          >
            {T.folha.naoGosto}
          </ToggleChip>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {emCasa ? (
          <Button
            variant="secondary"
            {...botao(`acabou:${item.id}`)}
            onPress={() => aMudar(tocar({ acao: "acabou", item_id: item.id }))}
          >
            {T.folha.acabou}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              {...botao(`tenho:${item.id}`)}
              onPress={() => aMudar(tocar({ acao: "tenho", item_id: item.id }))}
            >
              {T.folha.tenhoDeNovo}
            </Button>
            {alimento !== null && !item.na_lista ? (
              <Button
                variant="secondary"
                {...botao(`lista-por:${alimento}`)}
                onPress={() => aMudar(lista("por", alimento))}
              >
                {T.folha.porNaLista}
              </Button>
            ) : null}
            {item.na_lista ? <p className="text-sm text-ink-muted">{T.folha.jaNaLista}</p> : null}
          </>
        )}
        <Button
          variant="quiet"
          {...botao(`tirar:${item.id}`)}
          onPress={() => aMudar(tocar({ acao: "tirar", item_id: item.id }))}
        >
          {T.folha.tirar}
        </Button>
      </div>
    </div>
  )
}
