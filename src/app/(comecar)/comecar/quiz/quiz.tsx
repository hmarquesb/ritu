"use client"

import { useRouter } from "next/navigation"
import { Quiz as QuizBase } from "@/components/ritu/quiz/quiz"

type Props = Omit<Parameters<typeof QuizBase>[0], "destino" | "aoContinuar">

export function Quiz(props: Props) {
  const router = useRouter()
  return (
    <QuizBase
      {...props}
      destino="/api/onboarding/quiz"
      aoContinuar={() => router.push("/conversa")}
    />
  )
}
