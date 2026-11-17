"use client"

import { config } from "@config/index"
import { useCallback, useEffect, useReducer, useRef } from "react"
import type { ConversaDoDia } from "@/core/conversation/do-dia"
import type { VisaoDoRun } from "@/core/conversation/visao"
import { type AcaoDaConversa, inicial, reduzir, textoOtimista, visaoValida } from "./estado"
import { lerEventos } from "./ler-eventos"

const { intervaloMs, maximoMs } = config.telaConversa.consultaDoRun

type Voto = "up" | "down"
type CorpoDaTroca = { sugestao: number; alimento_id: string; motivo: string }
type CorpoDaRespostaDaTroca = {
  sugestao: number
  alimento_id: string
  candidato: string
  resposta: "tenho" | "nao_tenho"
}

function espera(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

async function codigoDoErro(resposta: Response): Promise<string> {
  try {
    const corpo: unknown = await resposta.json()
    if (ehObjeto(corpo) && typeof corpo.erro === "string") return corpo.erro
  } catch {
    // corpo que não é JSON: cai no código genérico
  }
  return "inesperado"
}

function abertosParaSeguir(runs: Record<string, VisaoDoRun>): string[] {
  return Object.values(runs)
    .filter((v) => v.pergunta?.estado === "aberta" || v.bloco?.estado === "aberto")
    .map((v) => v.run_id)
}

async function percorrer(
  corpo: ReadableStream<Uint8Array>,
  despachar: (acao: AcaoDaConversa) => void,
): Promise<{ runId?: string; terminou: boolean }> {
  let runId: string | undefined
  let terminou = false
  const leitor = corpo.pipeThrough(lerEventos()).getReader()
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      if (value.tipo === "inicio") runId = value.run_id
      if (value.tipo === "fim" || value.tipo === "erro") terminou = true
      despachar({ tipo: "evento", evento: value })
    }
  } catch {
    // conexão caiu no meio: quem chamou segue para a consulta
  }
  return { runId, terminou }
}

export function useConversa(conversa: ConversaDoDia, rotulos: Record<string, string> = {}) {
  const [estado, despachar] = useReducer(reduzir, conversa, inicial)
  const ref = useRef(estado)
  ref.current = estado
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  const mandar = useCallback(async (caminho: string, corpo?: unknown): Promise<Response> => {
    const resposta = await fetch(caminho, {
      method: corpo === undefined ? "GET" : "POST",
      headers: corpo === undefined ? undefined : { "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    if (resposta.status === 401) window.location.assign("/")
    return resposta
  }, [])

  const lerRun = useCallback(
    async (runId: string): Promise<VisaoDoRun | undefined> => {
      const resposta = await mandar(`/api/runs/${runId}`)
      if (!resposta.ok) return undefined
      const corpo: unknown = await resposta.json()
      if (!ehObjeto(corpo) || !visaoValida(corpo.visao)) return undefined
      despachar({
        tipo: "visao",
        visao: corpo.visao,
        pendentes: typeof corpo.pendentes === "number" ? corpo.pendentes : undefined,
      })
      return corpo.visao
    },
    [mandar],
  )

  const consultar = useCallback(
    async (runId: string) => {
      const inicio = Date.now()
      while (vivo.current && Date.now() - inicio < maximoMs) {
        await espera(intervaloMs)
        if (!vivo.current) return
        try {
          const visao = await lerRun(runId)
          if (visao && visao.status !== "running") return
        } catch {
          // falha de rede na consulta: tenta de novo até o teto
        }
      }
      if (vivo.current) despachar({ tipo: "falhou", codigo: "inesperado" })
    },
    [lerRun],
  )

  // Sem `fim` nem `erro` (a conexão caiu), consulta o run até ele sair de `running`.
  const lerFluxo = useCallback(
    async (resposta: Response, seguir: string[]) => {
      if (!resposta.ok || !resposta.body) {
        const codigo = resposta.ok ? "inesperado" : await codigoDoErro(resposta)
        despachar({ tipo: "evento", evento: { tipo: "erro", erro: codigo } })
        return
      }
      const { runId, terminou } = await percorrer(resposta.body, despachar)
      if (!terminou && runId) await consultar(runId)
      else if (!terminou) despachar({ tipo: "falhou" })
      for (const id of seguir) await lerRun(id).catch(() => undefined)
    },
    [consultar, lerRun],
  )

  const fluxo = useCallback(
    async (caminho: string, corpo: unknown, seguir: string[]) => {
      try {
        await lerFluxo(await mandar(caminho, corpo), seguir)
      } catch {
        despachar({ tipo: "falhou" })
      }
    },
    [lerFluxo, mandar],
  )

  const enviar = useCallback(async () => {
    const { caixa, runs } = ref.current
    if (caixa.respondendo) return
    const texto = caixa.texto.trim()
    if (texto === "" && caixa.atalhos.length === 0) return
    const mensagem = { ...(texto === "" ? {} : { texto }), atalhos: caixa.atalhos }
    despachar({ tipo: "enviou", texto: textoOtimista(mensagem, rotulos), mensagem })
    await fluxo("/api/runs", mensagem, abertosParaSeguir(runs))
  }, [fluxo, rotulos])

  const responder = useCallback(
    async (runId: string, resposta: unknown) => {
      despachar({ tipo: "retomou" })
      await fluxo(`/api/runs/${runId}/resposta`, resposta, [])
    },
    [fluxo],
  )

  // Rotas JSON: devolvem o corpo lido, ou `undefined` se falharam (o erro já foi para a tela).
  const chamarJson = useCallback(
    async (caminho: string, corpo: unknown): Promise<Record<string, unknown> | undefined> => {
      try {
        const resposta = await mandar(caminho, corpo)
        if (!resposta.ok) {
          despachar({ tipo: "falhou", codigo: await codigoDoErro(resposta) })
          return undefined
        }
        const lido: unknown = await resposta.json()
        return ehObjeto(lido) ? lido : undefined
      } catch {
        despachar({ tipo: "falhou" })
        return undefined
      }
    },
    [mandar],
  )

  const comVisao = useCallback(
    async (caminho: string, corpo: unknown) => {
      const lido = await chamarJson(caminho, corpo)
      if (lido && visaoValida(lido.visao)) despachar({ tipo: "visao", visao: lido.visao })
      return lido
    },
    [chamarJson],
  )

  const aprovar = useCallback(
    (runId: string, aprovadas: string[]) => comVisao(`/api/runs/${runId}/aprovacao`, { aprovadas }),
    [comVisao],
  )
  const trocar = useCallback(
    (runId: string, corpo: CorpoDaTroca) => comVisao(`/api/runs/${runId}/troca`, corpo),
    [comVisao],
  )
  const responderTroca = useCallback(
    (runId: string, corpo: CorpoDaRespostaDaTroca) =>
      comVisao(`/api/runs/${runId}/troca/resposta`, corpo),
    [comVisao],
  )

  const votar = useCallback(
    async (runId: string, voto: Voto) => {
      const lido = await chamarJson(`/api/runs/${runId}/voto`, { voto })
      const atual = ref.current.runs[runId]
      if (lido && atual) despachar({ tipo: "visao", visao: { ...atual, voto } })
    },
    [chamarJson],
  )

  const tentarDeNovo = useCallback(() => enviar(), [enviar])

  useEffect(() => {
    if (conversa.aberto?.status === "running") void consultar(conversa.aberto.run_id)
  }, [conversa.aberto, consultar])

  return {
    estado,
    enviar,
    responder,
    aprovar,
    trocar,
    responderTroca,
    votar,
    tentarDeNovo,
    digitar: (texto: string) => despachar({ tipo: "digitou", texto }),
    marcar: (atalhos: string[]) => despachar({ tipo: "marcou", atalhos }),
  }
}
