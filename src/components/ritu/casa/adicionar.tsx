"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { Sheet } from "@/components/base/dialog"
import { useBuscaDeAlimento } from "../alimento/use-busca-de-alimento"
import type { CasaEmUso } from "./use-casa"

const T = config.textosCasa
const MINIMO = config.limites.buscaDeAlimento.minimoCaracteres
const LIVRE = "__livre__"

type Props = { aberta: boolean; onFechar: () => void; tocar: CasaEmUso["tocar"] }

export function FolhaAdicionar({ aberta, onFechar, tocar }: Props) {
  const { busca, setBusca, achados, buscando, limpar } = useBuscaDeAlimento(MINIMO)

  const termo = busca.trim()
  const semResultado = !buscando && termo.length >= MINIMO && achados.length === 0
  const itens: { id: string; nome: string }[] = semResultado
    ? [{ id: LIVRE, nome: formatar(T.adicionarLivre, { texto: termo }) }]
    : achados

  async function escolher(chave: string | number | null) {
    if (chave === null) return
    const texto = termo
    limpar()
    if (chave === LIVRE) await tocar({ acao: "adicionar_texto", texto })
    else await tocar({ acao: "adicionar", alimento_id: String(chave) })
  }

  return (
    <Sheet
      title={T.adicionarTitulo}
      isOpen={aberta}
      onOpenChange={(valor) => {
        if (!valor) {
          limpar()
          onFechar()
        }
      }}
    >
      <ComboBox<{ id: string; nome: string }>
        label={T.adicionarBusca}
        emptyText={formatar(T.adicionarMinimo, { n: MINIMO })}
        isLoading={buscando}
        items={itens}
        inputValue={busca}
        onInputChange={setBusca}
        selectedKey={null}
        onSelectionChange={escolher}
        menuTrigger="input"
      >
        {(alimento) => <ComboBoxItem id={alimento.id}>{alimento.nome}</ComboBoxItem>}
      </ComboBox>
    </Sheet>
  )
}
