"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useEffect } from "react"
import { Button } from "@/components/base/button"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import {
  type Cidade,
  type ItemCidade,
  MINIMO_BUSCA_CIDADE,
  rotuloDaCidade,
  useBuscaDeCidade,
} from "./use-busca-de-cidade"

const textos = config.textosEntrada.componentes

type Props = {
  /** Chamado com a cidade escolhida, ou com null quando ela é limpa. */
  aoMudar: (cidade: Cidade | null) => void
  /** Mostra o botão que limpa a escolha. */
  comPular?: boolean
}

export function BuscaDeCidade({ aoMudar, comPular = false }: Props) {
  const c = useBuscaDeCidade()
  const { escolhida } = c

  useEffect(() => {
    aoMudar(escolhida)
  }, [escolhida, aoMudar])

  return (
    <div className="flex flex-col gap-4">
      <ComboBox<ItemCidade>
        label={textos.cidade.buscar}
        emptyText={
          c.busca.trim().length < MINIMO_BUSCA_CIDADE
            ? formatar(textos.buscaMinima, { n: MINIMO_BUSCA_CIDADE })
            : textos.cidade.nenhuma
        }
        isLoading={c.buscando}
        items={c.achadas}
        inputValue={c.busca}
        onInputChange={c.digitar}
        selectedKey={c.escolhida?.id ?? null}
        onSelectionChange={c.escolher}
        menuTrigger="input"
      >
        {(item) => <ComboBoxItem id={item.id}>{rotuloDaCidade(item)}</ComboBoxItem>}
      </ComboBox>
      {c.indisponivel && !c.escolhida ? (
        <p role="status" className="text-sm text-ink-muted">
          {textos.cidade.indisponivel}
        </p>
      ) : null}
      {comPular ? (
        <div>
          <Button variant="quiet" size="sm" onPress={c.limpar}>
            {textos.cidade.pular}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
