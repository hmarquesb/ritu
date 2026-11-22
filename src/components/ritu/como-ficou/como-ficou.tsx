"use client"

import { textosComoFicou } from "@config/index"
import { useCallback, useState } from "react"
import { StateBlock } from "@/components/base/state-block"
import { TextLink } from "@/components/base/text-link"
import { toast } from "@/components/base/toast"
import { avisarLimiteDeToque } from "@/components/ritu/limites"
import type { ComoFicouNaTela, RetornoNaTela } from "@/core/outcomes/visao"
import { ItemDeRetorno } from "./item"

const T = textosComoFicou

type Resultado = "ajudou" | "nao_ajudou" | "nao_fez"

function ehRetorno(v: unknown): v is RetornoNaTela {
  return typeof v === "object" && v !== null && "id" in v && "status" in v
}

async function enviar(id: string, resultado: Resultado) {
  const resposta = await fetch(`/api/retornos/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resultado }),
  })
  if (resposta.status === 401) {
    window.location.assign("/")
    return { tipo: "sessao" as const }
  }
  if (await avisarLimiteDeToque(resposta)) return { tipo: "limite" as const }
  if (resposta.ok) {
    const corpo: unknown = await resposta.json()
    const retorno =
      typeof corpo === "object" && corpo !== null && "retorno" in corpo ? corpo.retorno : null
    if (ehRetorno(retorno)) return { tipo: "ok" as const, retorno }
    return { tipo: "erro" as const }
  }
  const corpo: unknown = await resposta.json().catch(() => null)
  const codigo = typeof corpo === "object" && corpo !== null && "erro" in corpo ? corpo.erro : null
  return codigo === "toque_invalido" ? { tipo: "invalido" as const } : { tipo: "erro" as const }
}

export function ComoFicou({ inicial }: { inicial: ComoFicouNaTela }) {
  const [dias, setDias] = useState(inicial.dias)
  const [pendentes, setPendentes] = useState<Record<string, Resultado>>({})

  const responder = useCallback(async (id: string, resultado: Resultado) => {
    setPendentes((p) => ({ ...p, [id]: resultado }))
    const r = await enviar(id, resultado)
    setPendentes(({ [id]: _, ...resto }) => resto)
    if (r.tipo === "ok") {
      setDias((ds) =>
        ds.map((d) => ({ ...d, retornos: d.retornos.map((x) => (x.id === id ? r.retorno : x)) })),
      )
    } else if (r.tipo === "invalido") {
      setDias((ds) =>
        ds
          .map((d) => ({ ...d, retornos: d.retornos.filter((x) => x.id !== id) }))
          .filter((d) => d.retornos.length > 0),
      )
    } else if (r.tipo === "erro") {
      toast(T.erro, { tone: "danger" })
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-title text-title font-semibold text-ink">{T.titulo}</h1>
        <p className="font-body text-body text-ink-muted">{T.texto}</p>
      </header>
      <noscript>
        <p className="font-body text-body text-ink">{T.noscript}</p>
      </noscript>
      {dias.length === 0 ? (
        <StateBlock
          kind="empty"
          title={T.vazia.titulo}
          description={T.vazia.texto}
          action={<TextLink href="/conversa">{T.vazia.link}</TextLink>}
        />
      ) : (
        dias.map((d) => (
          <section key={d.dia} className="flex flex-col gap-3">
            <h2 className="font-body text-sm font-semibold text-ink-muted">{d.nome}</h2>
            <ul className="flex flex-col gap-3">
              {d.retornos.map((r) => (
                <ItemDeRetorno
                  key={r.id}
                  retorno={r}
                  pendente={pendentes[r.id] ?? null}
                  aoResponder={responder}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
