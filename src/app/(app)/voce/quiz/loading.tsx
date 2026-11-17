import { config } from "@config/index"
import { StateBlock } from "@/components/base/state-block"

export default function CarregandoQuiz() {
  return <StateBlock kind="loading" title={config.textosVoce.semDosha.quiz} />
}
