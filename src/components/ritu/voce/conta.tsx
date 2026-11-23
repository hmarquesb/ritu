"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Dialog } from "@/components/base/dialog"
import { Surface } from "@/components/base/surface"
import { TextLink } from "@/components/base/text-link"
import type { ThemeChoice } from "@/components/theme/theme"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import type { VoceNaTela } from "@/core/memory/ler"

const T = config.textosVoce.conta

function textoDaConta(conta: VoceNaTela["conta"]): string {
  if (conta.tipo === "google") return T.google
  const horas = Math.floor(conta.horas_restantes ?? 0)
  if (horas < 1) return T.demoMenosDeUmaHora
  if (horas === 1) return T.demoUmaHora
  return formatar(T.demo, { h: horas })
}

type Props = {
  conta: VoceNaTela["conta"]
  tema: ThemeChoice
  googleDisponivel: boolean
  criarPerfil: () => Promise<void>
  sair: () => Promise<void>
  apagar: () => Promise<void>
}

export function Conta({ conta, tema, googleDisponivel, criarPerfil, sair, apagar }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  return (
    <Surface
      as="section"
      aria-labelledby="voce-conta-titulo"
      tone="sunken"
      className="flex flex-col gap-5"
    >
      <h2 id="voce-conta-titulo" className="font-title text-title-sm font-medium text-ink">
        {T.titulo}
      </h2>
      <div className="flex flex-col gap-2">
        <p className="text-body text-ink">{textoDaConta(conta)}</p>
        {conta.tipo === "demo" && googleDisponivel ? (
          <form action={criarPerfil}>
            <Button type="submit" variant="primary" size="sm">
              {config.textosEntrada.faixa.botao}
            </Button>
          </form>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{T.tema}</span>
        <div>
          <ThemeSwitcher initial={tema} />
        </div>
      </div>
      <p className="text-body">
        <TextLink href="/sobre">{T.sobre}</TextLink>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          isPending={saindo}
          onPress={async () => {
            setSaindo(true)
            await sair()
          }}
        >
          {T.sair}
        </Button>
        <Button variant="danger" onPress={() => setConfirmando(true)}>
          {T.apagar}
        </Button>
      </div>
      <Dialog
        title={T.confirmaTitulo}
        description={T.confirmaTexto}
        role="alertdialog"
        isOpen={confirmando}
        onOpenChange={(aberto) => {
          if (!aberto && !apagando) setConfirmando(false)
        }}
      >
        {(close) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onPress={close}>
              {T.cancelar}
            </Button>
            <Button
              variant="danger"
              isPending={apagando}
              onPress={async () => {
                setApagando(true)
                await apagar()
              }}
            >
              {T.apagarTudo}
            </Button>
          </div>
        )}
      </Dialog>
    </Surface>
  )
}
