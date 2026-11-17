"use client"

import { config } from "@config/index"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Radio, RadioGroup } from "@/components/base/radio-group"
import { Surface } from "@/components/base/surface"
import { cx } from "@/components/cx"
import type { VisaoDoRun } from "@/core/conversation/visao"
import type { RespostaDaPessoa, RespostaDeCasa } from "@/core/runs/pergunta"

const T = config.textosConversa.pergunta
const [ROTULO_TENHO = "", ROTULO_SEM = "", ROTULO_GOSTO = ""] = T.opcoesCasa.split(" · ")
const [ROTULO_COMO = "", ROTULO_NAO_COMO = ""] = T.opcoesCome.split(" · ")

type PerguntaNaTela = NonNullable<VisaoDoRun["pergunta"]>
type PerguntaDeCasa = Extract<PerguntaNaTela["pergunta"], { tipo: "casa" }>

export type PerguntaDoAgenteProps = {
  pergunta: PerguntaNaTela
  aoResponder: (resposta: RespostaDaPessoa) => void
  className?: string
}

const CAIXA = "flex flex-col gap-3 font-body"

function PerguntaDeCasa({
  pergunta,
  aoResponder,
}: {
  pergunta: PerguntaDeCasa
  aoResponder: (r: RespostaDaPessoa) => void
}) {
  const [respostas, setRespostas] = useState<Record<string, RespostaDeCasa>>({})
  const responder = () => {
    const itens = pergunta.itens.flatMap((i) => {
      const resposta = respostas[i.alimento_id]
      return resposta ? [{ alimento_id: i.alimento_id, resposta }] : []
    })
    aoResponder({ tipo: "casa", itens })
  }
  return (
    <>
      {pergunta.itens.map((item) => (
        <RadioGroup
          key={item.alimento_id}
          label={item.nome}
          value={respostas[item.alimento_id] ?? null}
          onChange={(v) => setRespostas((r) => ({ ...r, [item.alimento_id]: v as RespostaDeCasa }))}
        >
          <Radio value="tenho">{ROTULO_TENHO}</Radio>
          <Radio value="nao_tenho">{ROTULO_SEM}</Radio>
          <Radio value="nao_gosto">{ROTULO_GOSTO}</Radio>
        </RadioGroup>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button onPress={responder}>{T.responder}</Button>
        <Button variant="quiet" onPress={() => aoResponder({ tipo: "pular" })}>
          {T.pular}
        </Button>
      </div>
    </>
  )
}

export function PerguntaDoAgente({ pergunta, aoResponder, className }: PerguntaDoAgenteProps) {
  if (pergunta.estado === "respondida") return null
  const conteudo = pergunta.pergunta
  if (pergunta.estado !== "aberta") {
    return (
      <Surface tone="raised" className={cx(CAIXA, className)}>
        <p role="status" className="text-body text-ink-muted">
          {pergunta.estado === "seguiu" ? T.seguiu : T.expirou}
        </p>
      </Surface>
    )
  }
  const botoes: { id: string; texto: string; resposta: RespostaDaPessoa }[] =
    conteudo.tipo === "come"
      ? [
          { id: "como", texto: ROTULO_COMO, resposta: { tipo: "come", resposta: "como" } },
          {
            id: "nao_como",
            texto: ROTULO_NAO_COMO,
            resposta: { tipo: "come", resposta: "nao_como" },
          },
        ]
      : conteudo.tipo === "variante"
        ? conteudo.opcoes.map((o) => ({
            id: o.id,
            texto: o.texto,
            resposta: { tipo: "variante", variante: o.id },
          }))
        : []
  return (
    <Surface tone="raised" className={cx(CAIXA, className)}>
      <p className="text-body text-ink">{conteudo.texto}</p>
      {conteudo.tipo === "casa" ? (
        <PerguntaDeCasa pergunta={conteudo} aoResponder={aoResponder} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {botoes.map((b) => (
            <Button key={b.id} variant="secondary" onPress={() => aoResponder(b.resposta)}>
              {b.texto}
            </Button>
          ))}
          <Button variant="quiet" onPress={() => aoResponder({ tipo: "pular" })}>
            {T.pular}
          </Button>
        </div>
      )}
    </Surface>
  )
}
