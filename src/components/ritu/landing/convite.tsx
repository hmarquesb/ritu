"use client"

import { textosLanding } from "@config/index"
import { ArrowDown } from "@phosphor-icons/react"
import { ICON } from "@/components/base/icon-size"

// "Conheça o Ritu": rola até #conheca e leva o foco ao h2 "Como funciona". Sem script, é só a âncora.
export function ConviteParaRolar({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/useValidAnchor: âncora real (funciona sem script); o clique só refina a rolagem e o foco
    <a
      href="#conheca"
      className={className}
      onClick={(evento) => {
        const secao = document.getElementById("conheca")
        const titulo = document.getElementById("como-funciona")
        if (!secao || !titulo) return
        evento.preventDefault()
        const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        secao.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" })
        titulo.focus({ preventScroll: true })
        history.replaceState(null, "", "#conheca")
      }}
    >
      {textosLanding.conheca}
      <ArrowDown weight="light" size={ICON.md} aria-hidden="true" />
    </a>
  )
}
