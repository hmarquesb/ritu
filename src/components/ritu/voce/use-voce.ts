"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useCallback, useRef, useState } from "react"
import { toast } from "@/components/base/toast"
import { avisarLimiteDeToque } from "@/components/ritu/limites"
import type { VoceNaTela } from "@/core/memory/ler"
import type { AcaoDaMemoria, AcaoDoPerfil } from "@/core/touches"

const T = config.textosVoce

type Acao = AcaoDoPerfil | AcaoDaMemoria

function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1)
}

// Identifica o toque em andamento para o `isPending` do botão certo.
export function chaveDoToque(acao: Acao): string {
  const partes = Object.entries(acao)
    .filter(([campo]) => campo !== "acao")
    .map(([, valor]) => {
      if (typeof valor === "string") return valor
      if (typeof valor === "object" && valor !== null && "valor" in valor) {
        return `${(valor as { tipo?: string }).tipo ?? ""}:${(valor as { valor: string }).valor}`
      }
      return ""
    })
    .filter((parte) => parte !== "")
  return [acao.acao, ...partes].join(":")
}

// 401 volta à entrada; 429 de limite de toques avisa por toast. `true` quando não há mais o que ler.
async function respostaTratada(resposta: Response): Promise<boolean> {
  if (resposta.status === 401) {
    window.location.assign("/")
    return true
  }
  return avisarLimiteDeToque(resposta)
}

function confirmacao(acao: Acao, nome: string): string {
  const valores = { item: nome, Item: maiuscula(nome), cidade: nome, nome }
  switch (acao.acao) {
    case "dosha":
    case "quiz":
      return formatar(T.confirma.dosha, valores)
    case "cidade":
      return nome === "" ? T.confirma.semCidade : formatar(T.confirma.cidade, valores)
    case "evitar_tirar":
    case "nao_come_tirar":
      return formatar(T.confirma.saiu, valores)
    case "esquecer":
      return formatar(T.confirma.esqueci, valores)
    case "nota_corrigir":
      return T.confirma.notaCorrigida
    case "nota_apagar":
      return T.confirma.notaApagada
    case "padrao_decidir":
      return acao.decisao === "confirmado" ? T.confirma.padraoConfirmado : T.confirma.padraoRecusado
    case "falta_apagar":
    case "padrao_apagar":
    case "conversa_apagar":
      return T.confirma.apagado
    default:
      return formatar(T.confirma.anotei, valores)
  }
}

type Resposta = { voce: VoceNaTela; nome: string }

function ehResposta(corpo: unknown): corpo is Resposta {
  if (typeof corpo !== "object" || corpo === null) return false
  const { voce, nome } = corpo as { voce?: unknown; nome?: unknown }
  return typeof voce === "object" && voce !== null && typeof nome === "string"
}

export function useVoce(inicial: VoceNaTela) {
  const [voce, setVoce] = useState(inicial)
  const [pendente, setPendente] = useState<string | null>(null)
  const ocupado = useRef(false)

  const reler = useCallback(async () => {
    try {
      const resposta = await fetch("/api/voce")
      if (resposta.status === 401) return window.location.assign("/")
      const corpo: unknown = await resposta.json()
      const lida = (corpo as { voce?: VoceNaTela } | null)?.voce
      if (lida) setVoce(lida)
    } catch {
      // A tela continua como estava; o aviso de erro já foi mostrado.
    }
  }, [])

  // Devolve a visão nova, ou `undefined` quando nada mudou. `aviso` troca o texto de confirmação.
  const enviar = useCallback(
    async (caminho: string, acao: Acao, aviso?: string): Promise<VoceNaTela | undefined> => {
      if (ocupado.current) return undefined
      ocupado.current = true
      setPendente(chaveDoToque(acao))
      try {
        const resposta = await fetch(caminho, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(acao),
        })
        if (await respostaTratada(resposta)) return undefined
        const dados: unknown = await resposta.json().catch(() => null)
        if (resposta.ok && ehResposta(dados)) {
          setVoce(dados.voce)
          toast(aviso ?? confirmacao(acao, dados.nome), { tone: "positive" })
          return dados.voce
        }
        const codigo = (dados as { erro?: string } | null)?.erro
        if (codigo === "conversa_em_andamento") {
          toast(T.conversa.emAndamento, { tone: "danger" })
          return undefined
        }
        toast(T.erro, { tone: "danger" })
        if (codigo === "toque_invalido") await reler()
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

  const perfil = useCallback(
    (acao: AcaoDoPerfil, aviso?: string) => enviar("/api/perfil", acao, aviso),
    [enviar],
  )
  const memoria = useCallback(
    (acao: AcaoDaMemoria, aviso?: string) => enviar("/api/memoria", acao, aviso),
    [enviar],
  )

  return { voce, pendente, perfil, memoria }
}

export type VoceEmUso = ReturnType<typeof useVoce>
