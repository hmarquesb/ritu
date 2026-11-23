import { config, textosSobre } from "@config/index"
import { publico } from "@config/publico"
import type { ReactNode } from "react"
import { TextLink } from "@/components/base/text-link"
import type { PrazosDaPolitica } from "@/core/publico/prazos"
import { Paragrafos } from "./secao"

const P = textosSobre.privacidade

type Valores = Record<string, string | number>
export type Preencher = (texto: string, valores: Valores) => string

export function dataPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: config.clima.fusoPadrao,
  }).format(new Date(`${iso}T12:00:00Z`))
}

function Parte({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-title text-xl font-semibold text-ink">{titulo}</h3>
      {children}
    </div>
  )
}

function Lista({
  itens,
  valores,
  preencher,
}: {
  itens: readonly string[]
  valores: Valores
  preencher: Preencher
}) {
  return (
    <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-prose text-ink marker:text-ink-muted">
      {itens.map((item) => (
        <li key={item}>{preencher(item, valores)}</li>
      ))}
    </ul>
  )
}

function Quem({
  contato,
  valores,
  preencher,
}: {
  contato: string | null
  valores: Valores
  preencher: Preencher
}) {
  if (contato === null) {
    return (
      <>
        <p className="max-w-prose text-prose text-ink">
          {preencher(P.quem.texto.split(" Para pedidos")[0] ?? "", valores)}
        </p>
        <p className="max-w-prose text-prose text-ink">{P.semContato}</p>
      </>
    )
  }
  const [antes, depois] = P.quem.texto.split("{email}")
  return (
    <p className="max-w-prose text-prose text-ink">
      {preencher(antes ?? "", valores)}
      <TextLink href={`mailto:${contato}`}>{contato}</TextLink>
      {depois}
    </p>
  )
}

/** A política de privacidade: introdução, data e as nove partes, cada uma com `h3`. */
export function Politica({
  contato,
  prazos,
  preencher,
}: {
  contato: string | null
  prazos: PrazosDaPolitica
  preencher: Preencher
}) {
  const valores = { ...prazos, nome: publico.autoria.nome, idadeMinima: publico.idadeMinima }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-muted">
        {"Atualizada em "}
        {dataPorExtenso(P.atualizadaEm)}.
      </p>
      <p className="max-w-prose text-prose text-ink">{P.intro}</p>
      <Parte titulo={P.quem.titulo}>
        <Quem contato={contato} valores={valores} preencher={preencher} />
      </Parte>
      <Parte titulo={P.guardo.titulo}>
        <Lista itens={P.guardo.itens} valores={valores} preencher={preencher} />
      </Parte>
      <Parte titulo={P.naoGuardo.titulo}>
        <Lista itens={P.naoGuardo.itens} valores={valores} preencher={preencher} />
      </Parte>
      <Parte titulo={P.tempo.titulo}>
        <Paragrafos texto={preencher(P.tempo.texto, valores)} />
      </Parte>
      <Parte titulo={P.passa.titulo}>
        <Lista itens={P.passa.itens} valores={valores} preencher={preencher} />
      </Parte>
      <Parte titulo={P.cookies.titulo}>
        <Paragrafos texto={preencher(P.cookies.texto, valores)} />
      </Parte>
      <Parte titulo={P.direitos.titulo}>
        <Paragrafos texto={P.direitos.texto} />
      </Parte>
      <Parte titulo={P.idade.titulo}>
        <Paragrafos texto={preencher(P.idade.texto, valores)} />
      </Parte>
      <Parte titulo={P.mudancas.titulo}>
        <Paragrafos texto={P.mudancas.texto} />
      </Parte>
    </div>
  )
}
