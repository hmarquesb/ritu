import { publico, textosLanding } from "@config/index"
import { TextLink } from "@/components/base/text-link"

const T = textosLanding

export function RodapePublico({ atual }: { atual?: "sobre" | "bastidores" }) {
  const corrente = (pagina: "sobre" | "bastidores") =>
    atual === pagina ? ({ "aria-current": "page" } as const) : {}
  return (
    <footer className="mx-auto flex w-full max-w-[64rem] flex-col gap-3 border-t border-line px-4 pb-10 pt-6 text-sm text-ink-muted min-[48rem]:px-6">
      <nav aria-label="Links do Ritu">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          <li>
            <TextLink
              href="/sobre"
              className="inline-flex min-h-11 items-center"
              {...corrente("sobre")}
            >
              {T.rodape.sobre}
            </TextLink>
          </li>
          <li>
            <TextLink
              href="/bastidores"
              className="inline-flex min-h-11 items-center"
              {...corrente("bastidores")}
            >
              {T.rodape.bastidores}
            </TextLink>
          </li>
          <li>
            <TextLink
              href={publico.repositorio}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center"
            >
              {T.rodape.codigo}
              <span className="sr-only">{T.novaAba}</span>
            </TextLink>
          </li>
        </ul>
      </nav>
      <p>{T.rodape.assinatura.replace("{nome}", publico.autoria.nome)}</p>
    </footer>
  )
}
