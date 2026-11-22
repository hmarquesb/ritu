"use client"

import { config } from "@config/index"
import { useState } from "react"
import { Sheet } from "@/components/base/dialog"
import type { ThemeChoice } from "@/components/theme/theme"
import type { VoceNaTela } from "@/core/memory/ler"
import { CartaDoDosha } from "./carta-dosha"
import { CasaNaMemoria } from "./casa"
import { Conta } from "./conta"
import { ConversaNaMemoria } from "./conversa"
import { FaltasNaMemoria } from "./faltas"
import { Fixos } from "./fixos"
import { FolhaDoDosha } from "./folha-dosha"
import { GostosNaMemoria } from "./gostos"
import { PadroesNaMemoria } from "./padroes"
import { RotinaNaMemoria } from "./rotina"
import { useVoce } from "./use-voce"

const T = config.textosVoce

type Props = {
  inicial: VoceNaTela
  grupos: { id: string; nome: string }[]
  tema: ThemeChoice
  googleDisponivel: boolean
  criarPerfil: () => Promise<void>
  sair: () => Promise<void>
  apagar: () => Promise<void>
}

export function Voce({
  inicial,
  grupos,
  tema,
  googleDisponivel,
  criarPerfil,
  sair,
  apagar,
}: Props) {
  const em = useVoce(inicial)
  const [folha, setFolha] = useState(false)
  const { voce } = em
  const { memoria } = voce
  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-title text-title font-semibold text-ink">{T.titulo}</h1>
      <CartaDoDosha painel={voce.painel} aoMudar={() => setFolha(true)} />
      <section aria-labelledby="voce-memoria-titulo" className="flex flex-col gap-6">
        <div>
          <h2 id="voce-memoria-titulo" className="font-title text-title-sm font-medium text-ink">
            {T.memoria.titulo}
          </h2>
          <p className="mt-1 max-w-prose text-body text-ink-muted">{T.memoria.texto}</p>
        </div>
        <Fixos fixos={memoria.fixos} em={em} grupos={grupos} aoMudarDosha={() => setFolha(true)} />
        <CasaNaMemoria casa={memoria.casa} />
        <GostosNaMemoria gostos={memoria.gostos} em={em} />
        <FaltasNaMemoria faltas={memoria.faltas} em={em} />
        <RotinaNaMemoria rotina={memoria.rotina} em={em} />
        <PadroesNaMemoria padroes={memoria.padroes} em={em} />
        <ConversaNaMemoria conversa={memoria.conversa} em={em} />
      </section>
      <Conta
        conta={voce.conta}
        tema={tema}
        googleDisponivel={googleDisponivel}
        criarPerfil={criarPerfil}
        sair={sair}
        apagar={apagar}
      />
      <Sheet title={T.dosha.folhaTitulo} isOpen={folha} onOpenChange={setFolha}>
        <FolhaDoDosha em={em} fechar={() => setFolha(false)} />
      </Sheet>
    </div>
  )
}
