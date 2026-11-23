"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { cx } from "@/components/cx"

// A seção sobe uma vez ao entrar na tela. Sem script ou com movimento reduzido, fica parada e visível.
export function Revelar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fase, setFase] = useState<"visivel" | "escondida" | "subindo">("visivel")

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setFase("escondida")
    const observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return
      setFase("subindo")
      observador.disconnect()
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cx(fase === "escondida" && "opacity-0", fase === "subindo" && "animate-rise")}
    >
      {children}
    </div>
  )
}
