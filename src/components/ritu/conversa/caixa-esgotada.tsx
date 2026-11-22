import { config } from "@config/index"
import { Button } from "@/components/base/button"
import { StateBlock } from "@/components/base/state-block"
import { Surface } from "@/components/base/surface"
import type { MotivoDoLimite } from "@/core/limits/estado"

export interface CaixaEsgotadaProps {
  motivo: MotivoDoLimite
  googleDisponivel: boolean
  /** Ação de servidor que abre a conta Google; vem por prop para este componente não importar `src/app/`. */
  entrarComGoogleAcao?: () => Promise<void>
  textoGuardado?: string
}

export function CaixaEsgotada({
  motivo,
  googleDisponivel,
  entrarComGoogleAcao,
  textoGuardado,
}: CaixaEsgotadaProps) {
  const t = config.textosLimites.esgotadas
  const { titulo, texto } = t[motivo]
  const comGoogle = motivo === "demo" && googleDisponivel && entrarComGoogleAcao
  return (
    <div className="flex flex-col gap-3">
      <StateBlock
        kind="quota"
        title={titulo}
        description={texto}
        action={
          comGoogle ? (
            <form action={entrarComGoogleAcao}>
              <Button type="submit" size="sm" variant="secondary">
                {t.demo.google}
              </Button>
            </form>
          ) : undefined
        }
      />
      {textoGuardado ? (
        <Surface tone="sunken" padding="sm" className="font-body text-sm">
          <p className="text-ink-muted">{t.textoGuardado}</p>
          <p className="mt-1 select-text whitespace-pre-wrap break-words text-ink">
            {textoGuardado}
          </p>
        </Surface>
      ) : null}
    </div>
  )
}
