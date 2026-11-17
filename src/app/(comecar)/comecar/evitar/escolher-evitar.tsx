"use client"

import { useRouter } from "next/navigation"
import { enviarPasso } from "@/app/(comecar)/_lib/enviar-passo"
import { EscolherEvitar as Escolha } from "@/components/ritu/evitar/escolher-evitar"

type Props = Omit<Parameters<typeof Escolha>[0], "gravar">

export function EscolherEvitar(props: Props) {
  const router = useRouter()
  return (
    <Escolha
      {...props}
      gravar={async (corpo) => {
        router.push(await enviarPasso("/api/onboarding/evitar", corpo))
      }}
    />
  )
}
