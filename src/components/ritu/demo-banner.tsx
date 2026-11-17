import { Button } from "@/components/base/button"

export interface DemoBannerProps {
  texto: string
  podeCriarPerfil: boolean
  /** Ação de servidor que abre a conta Google; vem por prop para este componente não importar `src/app/`. */
  entrarComGoogleAcao?: () => Promise<void>
  textoDoBotao?: string
}

export function DemoBanner({
  texto,
  podeCriarPerfil,
  entrarComGoogleAcao,
  textoDoBotao = "Criar meu perfil",
}: DemoBannerProps) {
  return (
    <aside aria-label="Demonstração" className="bg-amber-soft text-ink">
      <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
        <p className="min-w-0 flex-1 text-sm">{texto}</p>
        {podeCriarPerfil && entrarComGoogleAcao ? (
          <form action={entrarComGoogleAcao}>
            <Button type="submit" size="sm" variant="secondary">
              {textoDoBotao}
            </Button>
          </form>
        ) : null}
      </div>
    </aside>
  )
}
