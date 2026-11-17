"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { CaretDown } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { Chip } from "@/components/base/chip"
import { ICON } from "@/components/base/icon-size"
import { Menu, MenuItem } from "@/components/base/menu"
import type { ItemNaTela } from "@/core/conversation/visao"
import type { MotivoDaTroca, ResultadoDaTroca } from "@/core/touches/troca"

const T = config.textosConversa.sugestao
const [ROTULO_TROCAR = "", ROTULO_NAO_TENHO = "", ROTULO_NAO_GOSTO = ""] = T.menuItens.split(" · ")
const [ROTULO_TENHO = "", ROTULO_SEM = ""] = T.trocaOpcoes.split(" · ")

const PILULA =
  "inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-4 py-1.5 font-body text-sm font-medium text-ink"

export type IngredienteProps = {
  item: ItemNaTela
  podeTrocar: boolean
  resultado?: ResultadoDaTroca
  aoTrocar: (alimentoId: string, motivo: MotivoDaTroca) => void
  aoResponderTroca: (alimentoId: string, candidato: string, resposta: "tenho" | "nao_tenho") => void
}

function Retorno({
  item,
  resultado,
  aoResponderTroca,
}: Pick<IngredienteProps, "item" | "resultado" | "aoResponderTroca">) {
  if (resultado?.resultado === "perguntar") {
    const { pergunta } = resultado
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink">{formatar(T.trocaPergunta, { item: pergunta.nome })}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onPress={() => aoResponderTroca(item.alimento_id, pergunta.alimento_id, "tenho")}
          >
            {ROTULO_TENHO}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => aoResponderTroca(item.alimento_id, pergunta.alimento_id, "nao_tenho")}
          >
            {ROTULO_SEM}
          </Button>
        </div>
      </div>
    )
  }
  if (resultado?.resultado === "sem_substituto") {
    return <p className="text-sm text-ink-muted">{resultado.texto}</p>
  }
  if (item.troca) return <p className="text-sm text-ink-muted">{item.troca.frase}</p>
  return null
}

export function Ingrediente({
  item,
  podeTrocar,
  resultado,
  aoTrocar,
  aoResponderTroca,
}: IngredienteProps) {
  const nome = (
    <>
      {item.nome}
      {item.incerto ? (
        <span className="text-caption font-normal text-ink-muted">({T.incerto})</span>
      ) : null}
    </>
  )
  return (
    <li className="flex flex-col gap-1.5 font-body">
      {podeTrocar ? (
        <Menu
          label={formatar(T.menu, { item: item.nome })}
          onAction={(id) => aoTrocar(item.alimento_id, id as MotivoDaTroca)}
          trigger={
            <Chip aria-label={formatar(T.menu, { item: item.nome })} className="self-start">
              {nome}
              <CaretDown weight="light" size={ICON.sm} aria-hidden="true" />
            </Chip>
          }
        >
          <MenuItem id="trocar">{ROTULO_TROCAR}</MenuItem>
          <MenuItem id="nao_tenho">{ROTULO_NAO_TENHO}</MenuItem>
          <MenuItem id="nao_gosto">{ROTULO_NAO_GOSTO}</MenuItem>
        </Menu>
      ) : (
        <span className={`${PILULA} gap-1.5 self-start`}>{nome}</span>
      )}
      <div aria-live="polite">
        <Retorno item={item} resultado={resultado} aoResponderTroca={aoResponderTroca} />
      </div>
    </li>
  )
}
