"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import {
  BatteryLow,
  Cloud,
  Fire,
  type Icon,
  Leaf,
  Lightning,
  PaperPlaneRight,
  Snowflake,
  Sun,
} from "@phosphor-icons/react"
import { useId } from "react"
import { Button } from "@/components/base/button"
import { ToggleChip } from "@/components/base/chip"
import { TextField } from "@/components/base/text-field"
import { cx } from "@/components/cx"
import type { EstadoDosLimites } from "@/core/limits/estado"
import { CaixaEsgotada } from "./caixa-esgotada"
import { MensagensRestantes } from "./restantes"

const T = config.textosConversa.caixa

export type Atalho = { id: string; rotulo: string }

const ICONES: Record<string, Icon> = {
  com_frio: Snowflake,
  com_calor: Sun,
  pesada: Cloud,
  seca: Leaf,
  agitada: Lightning,
  irritada: Fire,
  sem_energia: BatteryLow,
}

export type CaixaDeMensagemProps = {
  texto: string
  atalhos: string[]
  atalhosDisponiveis: Atalho[]
  respondendo: boolean
  aoMudar: (v: { texto: string; atalhos: string[] }) => void
  aoEnviar: () => void
  limites?: EstadoDosLimites
  textoGuardado?: string
  googleDisponivel?: boolean
  entrarComGoogleAcao?: () => Promise<void>
  className?: string
}

function motivoDe(o: { respondendo: boolean; longa: boolean; vazia: boolean; n: number }) {
  if (o.respondendo) return T.respondendo
  if (o.longa) return formatar(T.longa, { n: o.n })
  return o.vazia ? T.vazia : null
}

function derivar(p: CaixaDeMensagemProps) {
  const mensagens = p.limites?.mensagens
  const esgotada = mensagens?.tipo === "esgotadas" ? mensagens : undefined
  const restantes =
    mensagens?.tipo === "contando" &&
    mensagens.restantes >= 1 &&
    mensagens.restantes <= config.limites.mensagens.avisarComRestantes
  const longa = !esgotada && p.texto.length > config.conversa.maxCaracteres
  const semTexto = p.texto.trim() === ""
  const vazia = p.atalhos.length === 0 && (esgotada !== undefined || semTexto)
  const mostraContador = !esgotada && p.texto.length >= config.telaConversa.contadorAPartirDe
  const motivo = motivoDe({ respondendo: p.respondendo, longa, vazia, n: p.texto.length })
  return {
    esgotada,
    restantes,
    longa,
    mostraContador,
    motivo,
    bloqueado: p.respondendo || longa || vazia,
  }
}

type AtalhosProps = Pick<CaixaDeMensagemProps, "atalhos" | "atalhosDisponiveis"> & {
  alternar: (id: string, marcado: boolean) => void
}

function ListaDeAtalhos({ atalhos, atalhosDisponiveis, alternar }: AtalhosProps) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-0.5 p-0 text-sm font-medium text-ink">{T.atalhos}</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {atalhosDisponiveis.map((a) => (
          <ToggleChip
            key={a.id}
            icon={ICONES[a.id]}
            className="shrink-0"
            isSelected={atalhos.includes(a.id)}
            onChange={(m) => alternar(a.id, m)}
          >
            {a.rotulo}
          </ToggleChip>
        ))}
      </div>
    </fieldset>
  )
}

type RodapeProps = {
  motivoId: string
  motivo: string | null
  longa: boolean
  contador: string | null
  bloqueado: boolean
  esgotada: boolean
}

function RodapeDaCaixa({ motivoId, motivo, longa, contador, bloqueado, esgotada }: RodapeProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p
        id={motivoId}
        role="status"
        className={cx("text-caption", longa ? "text-danger" : "text-ink-muted")}
      >
        {motivo ?? contador}
      </p>
      <Button
        type="submit"
        variant="primary"
        icon={esgotada ? undefined : PaperPlaneRight}
        aria-disabled={bloqueado || undefined}
        aria-describedby={motivo ? motivoId : undefined}
        className={cx(bloqueado && "opacity-50")}
      >
        {esgotada ? config.textosLimites.atalhos.enviar : T.enviar}
      </Button>
    </div>
  )
}

export function CaixaDeMensagem(props: CaixaDeMensagemProps) {
  const { texto, atalhos, respondendo, aoMudar, aoEnviar, limites, className } = props
  const motivoId = useId()
  const restantesId = useId()
  const { esgotada, restantes, longa, mostraContador, motivo, bloqueado } = derivar(props)

  function enviar() {
    if (!bloqueado) aoEnviar()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className={cx(
        "flex flex-col gap-1.5 border-t border-line bg-canvas px-4 pb-2 pt-1.5 font-body",
        className,
      )}
    >
      {esgotada ? (
        <CaixaEsgotada
          motivo={esgotada.motivo}
          googleDisponivel={props.googleDisponivel ?? false}
          entrarComGoogleAcao={props.entrarComGoogleAcao}
          textoGuardado={props.textoGuardado}
        />
      ) : null}
      <ListaDeAtalhos
        atalhos={atalhos}
        atalhosDisponiveis={props.atalhosDisponiveis}
        alternar={(id, marcado) =>
          aoMudar({
            texto,
            atalhos: marcado ? [...atalhos, id] : atalhos.filter((a) => a !== id),
          })
        }
      />
      {esgotada ? null : (
        <TextField
          multiline
          rows={2}
          label={T.rotulo}
          description={T.apoio}
          value={texto}
          aria-disabled={respondendo || undefined}
          aria-describedby={cx(respondendo && motivoId, restantes && restantesId) || undefined}
          onChange={(v) => aoMudar({ texto: v, atalhos })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              enviar()
            }
          }}
        />
      )}
      {esgotada || !limites ? null : (
        <MensagensRestantes estado={limites.mensagens} id={restantesId} />
      )}
      <RodapeDaCaixa
        motivoId={motivoId}
        motivo={motivo}
        longa={longa}
        contador={mostraContador ? formatar(T.longa, { n: texto.length }) : null}
        bloqueado={bloqueado}
        esgotada={esgotada !== undefined}
      />
    </form>
  )
}
