import { exigirPasso } from "@/app/_lib/conta"
import { propsDoQuiz } from "@/app/_lib/quiz"
import { Quiz } from "./quiz"

export const dynamic = "force-dynamic"

export default async function QuizDeVoce() {
  await exigirPasso("pronto")
  return <Quiz {...propsDoQuiz()} />
}
