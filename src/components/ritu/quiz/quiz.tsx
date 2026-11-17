"use client"

import { config } from "@config/index"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/base/button"
import { Surface } from "@/components/base/surface"
import { DoshaBlot } from "@/components/brand/dosha-blot"
import { cx } from "@/components/cx"

type Dosha = "vata" | "pitta" | "kapha"
type Pergunta = { id: string; texto: string; opcoes: { dosha: Dosha; texto: string }[] }
type Resultado = { nome: string; doshas: Dosha[]; dual: boolean }

const rotulos = config.textosEntrada.componentes.quiz

export type RespostasDoQuiz = { respostas: { pergunta_id: string; dosha: Dosha }[] }

type Props = {
  /** Rota que recebe as respostas (o onboarding usa `/api/onboarding/quiz`). */
  destino: string
  /** Chamado quando a pessoa toca em "Continuar" depois do resultado. */
  aoContinuar: () => void
  perguntas: Pergunta[]
  doshas: { id: Dosha; nome: string; resumo: string }[]
  textos: { progresso: string; resultado: string }
}

export function Quiz({ destino, aoContinuar, perguntas, doshas, textos }: Props) {
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, Dosha>>({})
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const montado = useRef(false)

  useEffect(() => {
    if (montado.current) titulo.current?.focus()
    montado.current = true
  }, [indice, resultado])

  const pergunta = perguntas[indice]
  const ultima = indice === perguntas.length - 1

  async function terminar() {
    if (enviando) return
    setEnviando(true)
    setErro(false)
    const corpo = {
      respostas: perguntas.map((p) => ({ pergunta_id: p.id, dosha: respostas[p.id] })),
    }
    try {
      const resposta = await fetch(destino, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      })
      if (resposta.status === 401) {
        window.location.href = "/"
        return
      }
      if (!resposta.ok) throw new Error("falhou")
      setResultado((await resposta.json()) as Resultado)
    } catch {
      setErro(true)
    }
    setEnviando(false)
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-6">
        <h1 ref={titulo} tabIndex={-1} className="font-title text-title text-ink outline-none">
          {textos.resultado.replace("{nome}", resultado.nome)}
        </h1>
        <div className="flex flex-col gap-4">
          {resultado.doshas.map((id) => {
            const info = doshas.find((d) => d.id === id)
            return (
              <Surface
                key={id}
                tone="paper"
                radius="card"
                padding="md"
                className="flex items-center gap-4"
              >
                <DoshaBlot dosha={id} size="md" />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="font-title text-title-sm">{info?.nome}</h2>
                  <p className="text-body">{info?.resumo}</p>
                </div>
              </Surface>
            )
          })}
        </div>
        <Button variant="primary" fullWidth onPress={aoContinuar}>
          {rotulos.continuar}
        </Button>
      </div>
    )
  }

  if (!pergunta) return null
  const atual = respostas[pergunta.id]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          {textos.progresso.replace("{n}", String(indice + 1))}
        </p>
        <progress
          aria-hidden="true"
          value={indice + 1}
          max={perguntas.length}
          className="h-1 w-full overflow-hidden rounded-pill bg-sunken accent-[var(--color-primary)]"
        />
        <h1 ref={titulo} tabIndex={-1} className="font-title text-title text-ink outline-none">
          {pergunta.texto}
        </h1>
      </div>
      <div role="radiogroup" aria-label={pergunta.texto} className="flex flex-col gap-3">
        {pergunta.opcoes.map((o) => (
          <label key={o.dosha} className="relative block">
            <input
              type="radio"
              name={pergunta.id}
              value={o.dosha}
              checked={atual === o.dosha}
              onChange={() => setRespostas((r) => ({ ...r, [pergunta.id]: o.dosha }))}
              className="peer sr-only"
            />
            <span
              className={cx(
                "flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 py-3 font-body text-body text-ink transition-colors duration-[var(--ritu-fast)] ease-ritu",
                "hover:bg-sunken peer-checked:border-primary peer-checked:bg-primary-soft",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              )}
            >
              {o.texto}
            </span>
          </label>
        ))}
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {rotulos.erro}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button
          fullWidth
          isDisabled={indice === 0 || enviando}
          onPress={() => setIndice((i) => Math.max(0, i - 1))}
        >
          {rotulos.voltar}
        </Button>
        <Button
          variant="primary"
          fullWidth
          isPending={enviando}
          aria-disabled={!atual || undefined}
          className={atual ? undefined : "opacity-50"}
          onPress={() => {
            if (!atual) return
            if (ultima) void terminar()
            else setIndice((i) => i + 1)
          }}
        >
          {ultima ? rotulos.verResultado : rotulos.proxima}
        </Button>
      </div>
    </div>
  )
}
