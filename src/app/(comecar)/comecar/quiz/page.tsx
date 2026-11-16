import { config } from "@config/index"
import { exigirPasso } from "@/app/_lib/conta"
import { getContainer } from "@/infra/container"
import { Quiz } from "./quiz"

export const dynamic = "force-dynamic"

const { quiz } = config.textosEntrada

export default async function QuizPage() {
  await exigirPasso("dosha")
  const { quiz: perguntas, doshas } = getContainer().knowledge
  return (
    <Quiz
      perguntas={perguntas.map(({ id, texto, opcoes }) => ({ id, texto, opcoes: [...opcoes] }))}
      doshas={doshas.map(({ id, nome, resumo }) => ({ id, nome, resumo }))}
      textos={quiz}
    />
  )
}
