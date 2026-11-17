import { config } from "@config/index"
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react"
import { ToggleButton } from "@/components/base/toggle-button"
import { cx } from "@/components/cx"
import type { VisaoDoRun } from "@/core/conversation/visao"

const T = config.textosConversa.rodape

type Voto = NonNullable<VisaoDoRun["voto"]>

export type RodapeDaRespostaProps = {
  voto?: Voto
  podeVotar: boolean
  aoVotar: (v: Voto) => void
  className?: string
}

export function RodapeDaResposta({ voto, podeVotar, aoVotar, className }: RodapeDaRespostaProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2 font-body", className)}>
      <p className="text-caption text-ink-muted">{T.aviso}</p>
      <div className="flex items-center">
        <ToggleButton
          icon={ThumbsUp}
          aria-label={T.gostei}
          isSelected={voto === "up"}
          isDisabled={!podeVotar}
          onChange={() => aoVotar("up")}
        />
        <ToggleButton
          icon={ThumbsDown}
          aria-label={T.naoGostei}
          isSelected={voto === "down"}
          isDisabled={!podeVotar}
          onChange={() => aoVotar("down")}
        />
      </div>
    </div>
  )
}
