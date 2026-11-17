"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useCallback, useRef, useState } from "react"
import { toast } from "@/components/base/toast"
import { avisarLimiteDeToque } from "@/components/ritu/limites"
import type { CasaNaTela } from "@/core/pantry/visao"
import type { AcaoDaCasa } from "@/core/touches"

const T = config.textosCasa

export type Gosto = "gosta" | "nao_gosta" | null
export type AcaoDaLista = "por" | "tirar"

function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1)
}

function confirmacao(modelo: string, nome: string): string {
  return formatar(modelo, { Item: maiuscula(nome), item: nome.toLocaleLowerCase("pt-BR") })
}

function modeloDoToque(acao: AcaoDaCasa): string {
  switch (acao.acao) {
    case "adicionar":
    case "adicionar_texto":
      return T.adicionado
    case "tenho":
      return T.confirma.tenho
    case "acabou":
      return T.confirma.acabou
    case "sempre_tenho":
      return acao.valor ? T.confirma.sempre : T.confirma.semSempre
    case "tirar":
      return T.confirma.tirado
  }
}

function modeloDoGosto(gosto: Gosto): string {
  if (gosto === "gosta") return T.confirma.gosta
  if (gosto === "nao_gosta") return T.confirma.naoGosta
  return T.confirma.semGosto
}

type Resposta = { casa: CasaNaTela; nome: string }

function ehResposta(corpo: unknown): corpo is Resposta {
  if (typeof corpo !== "object" || corpo === null) return false
  const { casa, nome } = corpo as { casa?: unknown; nome?: unknown }
  return typeof casa === "object" && casa !== null && typeof nome === "string"
}

export function useCasa(inicial: CasaNaTela) {
  const [casa, setCasa] = useState(inicial)
  const [pendente, setPendente] = useState<string | null>(null)
  const ocupado = useRef(false)

  const reler = useCallback(async () => {
    try {
      const resposta = await fetch("/api/casa")
      if (resposta.status === 401) return window.location.assign("/")
      const corpo: unknown = await resposta.json()
      const lida = (corpo as { casa?: CasaNaTela } | null)?.casa
      if (lida) setCasa(lida)
    } catch {
      // A casa na tela continua; o aviso de erro já foi mostrado.
    }
  }, [])

  // Devolve a casa nova, ou `undefined` quando nada mudou.
  const enviar = useCallback(
    async (
      caminho: string,
      corpo: unknown,
      chave: string,
      modelo: string,
    ): Promise<CasaNaTela | undefined> => {
      if (ocupado.current) return undefined
      ocupado.current = true
      setPendente(chave)
      try {
        const resposta = await fetch(caminho, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corpo),
        })
        if (resposta.status === 401) {
          window.location.assign("/")
          return undefined
        }
        if (await avisarLimiteDeToque(resposta)) return undefined
        const dados: unknown = await resposta.json().catch(() => null)
        if (resposta.ok && ehResposta(dados)) {
          setCasa(dados.casa)
          toast(confirmacao(modelo, dados.nome), { tone: "positive" })
          return dados.casa
        }
        toast(T.erro, { tone: "danger" })
        if ((dados as { erro?: string } | null)?.erro === "toque_invalido") await reler()
        return undefined
      } catch {
        toast(T.erro, { tone: "danger" })
        return undefined
      } finally {
        ocupado.current = false
        setPendente(null)
      }
    },
    [reler],
  )

  const tocar = useCallback(
    (acao: AcaoDaCasa) => {
      const alvo = "item_id" in acao ? acao.item_id : "alimento_id" in acao ? acao.alimento_id : ""
      return enviar("/api/casa", acao, `${acao.acao}:${alvo}`, modeloDoToque(acao))
    },
    [enviar],
  )

  const gostar = useCallback(
    (alimento_id: string, gosto: Gosto) =>
      enviar(
        "/api/preferencias",
        { alimento_id, gosto },
        `gosto:${alimento_id}`,
        modeloDoGosto(gosto),
      ),
    [enviar],
  )

  const lista = useCallback(
    (acao: AcaoDaLista, alimento_id: string) =>
      enviar(
        "/api/lista",
        { acao, alimento_id },
        `lista-${acao}:${alimento_id}`,
        acao === "por" ? T.confirma.naLista : T.confirma.foraDaLista,
      ),
    [enviar],
  )

  return { casa, pendente, tocar, gostar, lista }
}

export type CasaEmUso = ReturnType<typeof useCasa>
