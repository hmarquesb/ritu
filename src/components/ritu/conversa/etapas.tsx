import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Spinner } from "@/components/base/spinner"
import { TextLink } from "@/components/base/text-link"
import { cx } from "@/components/cx"
import type { FraseDeEtapa } from "@/core/conversation/etapas"

const T = config.textosConversa.etapas

export function EtapasAoVivo({
  frases,
  className,
}: {
  frases: FraseDeEtapa[]
  className?: string
}) {
  return (
    <ul
      aria-busy="true"
      className={cx("flex flex-col gap-1.5 font-body text-sm text-ink-muted", className)}
    >
      {frases.map((f, i) => (
        <li key={f.chave} className="flex items-center gap-2">
          <span>{f.texto}</span>
          {i === frases.length - 1 ? <Spinner label={T.ainda} /> : null}
        </li>
      ))}
    </ul>
  )
}

export function EtapasRecolhidas({
  passos,
  runId,
  className,
}: {
  passos: number
  runId: string
  className?: string
}) {
  const resumo = passos === 1 ? T.passo : passos > 1 ? formatar(T.passos, { n: passos }) : null
  return (
    <p className={cx("font-body text-sm text-ink-muted", className)}>
      {resumo ? <span>{resumo} · </span> : null}
      <TextLink href={`/como-pensei/${runId}`}>{T.comoPensei}</TextLink>
    </p>
  )
}
