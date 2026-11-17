"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type Alimento = { id: string; nome: string }

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

// Busca de alimento da base com espera de 200 ms; só a última pergunta vale.
export function useBuscaDeAlimento(minimo: number) {
  const [busca, setBusca] = useState("")
  const [achados, setAchados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)
  const pedido = useRef(0)

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < minimo) {
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
  }, [busca, minimo])

  const limpar = useCallback(() => {
    setBusca("")
    setAchados([])
  }, [])

  return { busca, setBusca, achados, buscando, limpar }
}
