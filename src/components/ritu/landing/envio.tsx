"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/base/button"

// Botão de envio dos formulários da chamada final: fica `isPending` enquanto a ação do servidor roda.
export function BotaoDeEnvioDaLanding(props: {
  variante: "primary" | "secondary"
  children: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={props.variante} isPending={pending}>
      {props.children}
    </Button>
  )
}
