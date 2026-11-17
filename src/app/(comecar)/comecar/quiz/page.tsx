import { exigirPasso } from "@/app/_lib/conta"
import { propsDoQuiz } from "@/app/_lib/quiz"
import { Quiz } from "./quiz"

export const dynamic = "force-dynamic"

export default async function QuizPage() {
  await exigirPasso("dosha")
  return <Quiz {...propsDoQuiz()} />
}
