"use client"

import { useEffect, useRef, useState } from "react"

export type Cidade = {
  nome: string
  regiao?: string
  pais: string
  lat: number
  lon: number
  fuso: string
}
export type ItemCidade = Cidade & { id: string }

export const MINIMO_BUSCA_CIDADE = 2
export const rotuloDaCidade = (c: Cidade) => [c.nome, c.regiao, c.pais].filter(Boolean).join(", ")
const idDe = (c: Cidade) => `${c.lat},${c.lon}`

type Resultado = { itens: ItemCidade[]; indisponivel: boolean }

async function buscarCidades(termo: string, signal: AbortSignal): Promise<Resultado> {
  try {
    const resposta = await fetch(`/api/cidades?q=${encodeURIComponent(termo)}`, { signal })
    if (resposta.status === 401) {
      window.location.href = "/"
      return { itens: [], indisponivel: false }
    }
    if (!resposta.ok) return { itens: [], indisponivel: true }
    const { cidades } = (await resposta.json()) as { cidades: Cidade[] }
    return { itens: cidades.map((c) => ({ ...c, id: idDe(c) })), indisponivel: false }
  } catch {
    return { itens: [], indisponivel: !signal.aborted }
  }
}

export function useBuscaDeCidade() {
  const [busca, setBusca] = useState("")
  const [achadas, setAchadas] = useState<ItemCidade[]>([])
  const [buscando, setBuscando] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [escolhida, setEscolhida] = useState<ItemCidade | null>(null)
  const pedido = useRef(0)

  useEffect(() => {
    const termo = busca.trim()
    if (escolhida || termo.length < MINIMO_BUSCA_CIDADE) {
      setAchadas([])
      setBuscando(false)
      return
    }
    const numero = ++pedido.current
    const controle = new AbortController()
    setBuscando(true)
    const espera = setTimeout(async () => {
      const r = await buscarCidades(termo, controle.signal)
      if (numero !== pedido.current) return
      setAchadas(r.itens)
      setIndisponivel(r.indisponivel)
      setBuscando(false)
    }, 250)
    return () => {
      clearTimeout(espera)
      controle.abort()
    }
  }, [busca, escolhida])

  function digitar(valor: string) {
    setBusca(valor)
    if (escolhida && valor !== rotuloDaCidade(escolhida)) setEscolhida(null)
  }
  function escolher(id: string | number | null) {
    const achada = achadas.find((c) => c.id === id)
    if (!achada) return
    setEscolhida(achada)
    setBusca(rotuloDaCidade(achada))
  }
  function limpar() {
    setEscolhida(null)
    setBusca("")
    setAchadas([])
  }
  return { busca, achadas, buscando, indisponivel, escolhida, digitar, escolher, limpar }
}
