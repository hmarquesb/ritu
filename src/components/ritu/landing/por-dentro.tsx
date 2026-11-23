import { publico, textosLanding } from "@config/index"
import type { Icon } from "@phosphor-icons/react"
import { ChartLine, GithubLogo, Plugs } from "@phosphor-icons/react/dist/ssr"
import { ICON } from "@/components/base/icon-size"
import { TextLink } from "@/components/base/text-link"

const T = textosLanding

function Item({
  href,
  Glyph,
  children,
  externo,
}: {
  href: string
  Glyph: Icon
  children: string
  externo?: boolean
}) {
  return (
    <li>
      <TextLink
        href={href}
        className="inline-flex min-h-11 items-center gap-2"
        {...(externo ? { target: "_blank", rel: "noopener" } : {})}
      >
        <Glyph weight="light" size={ICON.md} aria-hidden="true" />
        {children}
        {externo ? <span className="sr-only">{T.novaAba}</span> : null}
      </TextLink>
    </li>
  )
}

export function PorDentro() {
  return (
    <section aria-labelledby="por-dentro" className="flex max-w-prose flex-col gap-4">
      <h2 id="por-dentro" className="font-title text-title text-ink">
        {T.dentro.titulo}
      </h2>
      <p className="text-prose text-ink">{T.dentro.texto}</p>
      <ul className="flex flex-col gap-1">
        <Item href="/bastidores" Glyph={ChartLine}>
          {T.dentro.bastidores}
        </Item>
        <Item href="/bastidores#mcp" Glyph={Plugs}>
          {T.dentro.mcp}
        </Item>
        <Item href={publico.repositorio} Glyph={GithubLogo} externo>
          {T.dentro.codigo}
        </Item>
      </ul>
    </section>
  )
}
