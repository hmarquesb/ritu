import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { TextLink } from "@/components/base/text-link"
import { cx } from "@/components/cx"

const T = config.textosConversa.retornos

export function IndicadorDeRetornos({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <p className={cx("px-4 font-body text-sm", className)}>
      <TextLink href="/como-ficou" className="inline-flex min-h-6 items-center py-1">
        {n === 1 ? T.um : formatar(T.varios, { n })}
      </TextLink>
    </p>
  )
}
