"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/base/button"

export function AceitarAviso({ rotulo }: { rotulo: string }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(false)

  async function aceitar() {
    setEnviando(true)
    setErro(false)
    try {
      const resposta = await fetch("/api/onboarding/aviso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      if (resposta.status === 401) {
        window.location.href = "/"
        return
      }
      if (!resposta.ok) throw new Error("falhou")
      const { proximo } = (await resposta.json()) as { proximo: string }
      router.push(proximo)
    } catch {
      setErro(true)
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" fullWidth isPending={enviando} onPress={aceitar}>
        {rotulo}
      </Button>
      {erro ? (
        <p role="alert" className="text-sm text-danger">
          Não consegui continuar agora. Verifique a conexão e toque de novo.
        </p>
      ) : null}
    </div>
  )
}
