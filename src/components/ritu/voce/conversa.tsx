"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Trash } from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/base/button"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { Confirmacao, ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import { chaveDoToque, type VoceEmUso } from "./use-voce"

const T = config.textosVoce

type Dia = MemoriaNaTela["conversa"][number]

// "Hoje" fica "hoje" no meio da frase; "Há 3 dias" vira "há 3 dias".
const minuscula = (texto: string) => texto.charAt(0).toLocaleLowerCase("pt-BR") + texto.slice(1)

type Props = { conversa: Dia[]; em: VoceEmUso }

export function ConversaNaMemoria({ conversa, em }: Props) {
  const [apagando, setApagando] = useState<Dia | null>(null)
  const acao = apagando ? ({ acao: "conversa_apagar", dia: apagando.dia } as const) : null
  return (
    <NivelDaMemoria
      id="conversa"
      titulo={T.nivel.conversa.titulo}
      como={T.nivel.conversa.como}
      vazio={conversa.length === 0 ? T.nivel.conversa.vazio : null}
      rodape={<p className="mt-4 text-sm text-ink-muted">{T.naoGuardo}</p>}
    >
      <ListaDeMemoria>
        {conversa.map((dia) => (
          <ItemDeMemoria
            key={dia.dia}
            principal={formatar(dia.total === 1 ? T.conversa.linhaUma : T.conversa.linha, {
              dia: dia.nome,
              n: dia.total,
            })}
            acoes={
              <Button
                variant="quiet"
                size="sm"
                icon={Trash}
                aria-label={`${T.apagar}: ${minuscula(dia.nome)}`}
                onPress={() => setApagando(dia)}
              >
                {T.apagar}
              </Button>
            }
          />
        ))}
      </ListaDeMemoria>
      <Confirmacao
        titulo={formatar(T.conversa.confirmaTitulo, { dia: minuscula(apagando?.nome ?? "") })}
        texto={T.conversa.confirmaTexto}
        confirmar={T.apagar}
        aberto={apagando !== null}
        aoFechar={() => setApagando(null)}
        pendente={acao !== null && em.pendente === chaveDoToque(acao)}
        aoConfirmar={async () => {
          if (!acao) return false
          const nova = await em.memoria(
            acao,
            formatar(T.confirma.conversaApagada, { dia: minuscula(apagando?.nome ?? "") }),
          )
          if (nova) focarNivel("conversa")
          return nova !== undefined
        }}
      />
    </NivelDaMemoria>
  )
}
