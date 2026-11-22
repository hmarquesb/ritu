"use client"

import { config } from "@config/index"
import { useRouter } from "next/navigation"
import { Quiz as QuizBase } from "@/components/ritu/quiz/quiz"

type Props = Omit<
  Parameters<typeof QuizBase>[0],
  "destino" | "aoContinuar" | "acao" | "rotuloContinuar"
>

export function Quiz(props: Props) {
  const router = useRouter()
  return (
    <QuizBase
      {...props}
      destino="/api/perfil"
      acao="quiz"
      rotuloContinuar={config.textosVoce.quiz.voltar}
      aoContinuar={() => router.push("/voce")}
    />
  )
}
