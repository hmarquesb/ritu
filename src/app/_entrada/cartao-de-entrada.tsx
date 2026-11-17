"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/base/button"

// Botão de envio do formulário da Entrada: fica `isPending` enquanto a ação do servidor roda.
export function BotaoDeEnvio(props: { variante: "primary" | "secondary"; children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={props.variante} fullWidth isPending={pending}>
      {props.children}
    </Button>
  )
}
