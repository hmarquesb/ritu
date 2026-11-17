"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Check, Trash, X } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { dataCurta, ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import { chaveDoToque, type VoceEmUso } from "./use-voce"

const T = config.textosVoce

type Padrao = MemoriaNaTela["padroes"][number]

function complemento(p: Padrao, fuso: string): string | null {
  if (p.status === "confirmado") {
    return p.decidido_em
      ? formatar(T.padroes.confirmado, { data: dataCurta(p.decidido_em, fuso) })
      : null
  }
  return p.status === "recusado" ? T.padroes.recusado : null
}

function AcoesDoPadrao({ padrao, em }: { padrao: Padrao; em: VoceEmUso }) {
  const decidir = (decisao: "confirmado" | "recusado") =>
    ({ acao: "padrao_decidir", padrao_id: padrao.id, decisao }) as const
  const apagar = { acao: "padrao_apagar", padrao_id: padrao.id } as const
  if (padrao.status === "candidato") {
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          icon={Check}
          aria-label={formatar(T.padroes.certoPadrao, { nome: padrao.frase })}
          isPending={em.pendente === chaveDoToque(decidir("confirmado"))}
          onPress={async () => {
            if (await em.memoria(decidir("confirmado"))) focarNivel("padroes")
          }}
        >
          {T.padroes.certo}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          icon={X}
          aria-label={formatar(T.padroes.naoEstaPadrao, { nome: padrao.frase })}
          isPending={em.pendente === chaveDoToque(decidir("recusado"))}
          onPress={async () => {
            if (await em.memoria(decidir("recusado"))) focarNivel("padroes")
          }}
        >
          {T.padroes.naoEsta}
        </Button>
      </>
    )
  }
  return (
    <Button
      variant="quiet"
      size="sm"
      icon={Trash}
      aria-label={formatar(T.padroes.apagarPadrao, { nome: padrao.frase })}
      isPending={em.pendente === chaveDoToque(apagar)}
      onPress={async () => {
        const aviso = padrao.status === "recusado" ? T.padroes.apagadoRecusado : undefined
        if (await em.memoria(apagar, aviso)) focarNivel("padroes")
      }}
    >
      {T.apagar}
    </Button>
  )
}

export function PadroesNaMemoria({ padroes, em }: { padroes: Padrao[]; em: VoceEmUso }) {
  return (
    <NivelDaMemoria
      id="padroes"
      titulo={T.nivel.padroes.titulo}
      como={T.nivel.padroes.como}
      vazio={padroes.length === 0 ? T.nivel.padroes.vazio : null}
    >
      <ListaDeMemoria>
        {padroes.map((p) => (
          <ItemDeMemoria
            key={p.id}
            principal={p.frase}
            complemento={complemento(p, em.voce.fuso)}
            acoes={<AcoesDoPadrao padrao={p} em={em} />}
          />
        ))}
      </ListaDeMemoria>
    </NivelDaMemoria>
  )
}
