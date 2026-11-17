"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useEffect, useRef, useState } from "react"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { Sheet } from "@/components/base/dialog"
import type { CasaEmUso } from "./use-casa"

const T = config.textosCasa
const MINIMO = config.limites.buscaDeAlimento.minimoCaracteres
const LIVRE = "__livre__"

type Alimento = { id: string; nome: string }

async function buscar(termo: string, signal: AbortSignal): Promise<Alimento[]> {
  try {
    const resposta = await fetch(`/api/alimentos?q=${encodeURIComponent(termo)}`, { signal })
    if (resposta.status === 401) {
      window.location.assign("/")
      return []
    }
    if (!resposta.ok) return []
    return ((await resposta.json()) as { alimentos: Alimento[] }).alimentos
  } catch {
    return []
  }
}

type Props = { aberta: boolean; onFechar: () => void; tocar: CasaEmUso["tocar"] }

export function FolhaAdicionar({ aberta, onFechar, tocar }: Props) {
  const [busca, setBusca] = useState("")
  const [achados, setAchados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)
  const pedido = useRef(0)

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < MINIMO) {
      setAchados([])
      setBuscando(false)
      return
    }
    const numero = ++pedido.current
    const controle = new AbortController()
    setBuscando(true)
    const espera = setTimeout(async () => {
      const dados = await buscar(termo, controle.signal)
      if (numero !== pedido.current) return
      setAchados(dados)
      setBuscando(false)
    }, 200)
    return () => {
      clearTimeout(espera)
      controle.abort()
    }
  }, [busca])

  const termo = busca.trim()
  const semResultado = !buscando && termo.length >= MINIMO && achados.length === 0
  const itens: { id: string; nome: string }[] = semResultado
    ? [{ id: LIVRE, nome: formatar(T.adicionarLivre, { texto: termo }) }]
    : achados

  async function escolher(chave: string | number | null) {
    if (chave === null) return
    const texto = termo
    setBusca("")
    setAchados([])
    if (chave === LIVRE) await tocar({ acao: "adicionar_texto", texto })
    else await tocar({ acao: "adicionar", alimento_id: String(chave) })
  }

  return (
    <Sheet
      title={T.adicionarTitulo}
      isOpen={aberta}
      onOpenChange={(valor) => {
        if (!valor) {
          setBusca("")
          setAchados([])
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
