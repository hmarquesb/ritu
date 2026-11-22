"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Link } from "react-aria-components"
import { Button } from "@/components/base/button"
import { Surface } from "@/components/base/surface"
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs"
import { DoshaBlot } from "@/components/brand/dosha-blot"
import { cx } from "@/components/cx"
import type { CartaDeDosha, PainelDoDosha } from "@/core/accounts/painel"

const T = config.textosVoce

type Dosha = CartaDeDosha["dosha"]
type Painel = PainelDoDosha

const NOME: Record<Dosha, string> = T.dosha.nomes
const COR: Record<Dosha, string> = { vata: "bg-vata", pitta: "bg-pitta", kapha: "bg-kapha" }

// "a", "a e b", "a, b e c".
function listaEmPalavras(itens: string[]): string {
  if (itens.length <= 1) return itens.join("")
  return `${itens.slice(0, -1).join(", ")} e ${itens.slice(-1).join("")}`
}

const LINK_BOTAO =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-pill px-5 py-2 text-body font-medium outline-none transition-colors duration-[var(--ritu-fast)] ease-ritu data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"

function LinkQuiz({ primario, children }: { primario: boolean; children: string }) {
  return (
    <Link
      href="/voce/quiz"
      className={cx(
        LINK_BOTAO,
        primario
          ? "bg-primary text-on-primary data-hovered:bg-primary-hover data-pressed:bg-primary-pressed"
          : "border border-paper-ink/40 text-paper-ink data-hovered:bg-paper-ink/10",
      )}
    >
      {children}
    </Link>
  )
}

function Manchas({ doshas, size }: { doshas: Dosha[]; size: "sm" | "md" | "lg" }) {
  return (
    <div className="flex items-center" aria-hidden="true">
      {doshas.map((dosha, i) => (
        <span
          key={dosha}
          className={cx("relative inline-flex", i > 0 && (size === "sm" ? "-ml-3" : "-ml-10"))}
          style={{ zIndex: doshas.length - i }}
        >
          <DoshaBlot dosha={dosha} size={size} withIcon={size !== "sm"} />
        </span>
      ))}
    </div>
  )
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-paper-ink">{titulo}</h4>
      <p className="text-body text-paper-ink">{texto}</p>
    </div>
  )
}

function ConteudoDaCarta({ carta }: { carta: CartaDeDosha }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-prose text-paper-ink">{carta.resumo}</p>
      <p className="text-sm text-paper-ink/80">
        {formatar(T.dosha.elementos, { lista: listaEmPalavras(carta.elementos) })}
        <br />
        {formatar(T.dosha.qualidades, { lista: listaEmPalavras(carta.qualidades) })}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Bloco titulo={T.dosha.corpo} texto={carta.corpo} />
        <Bloco titulo={T.dosha.mente} texto={carta.mente} />
        <Bloco titulo={T.dosha.digestao} texto={carta.digestao} />
      </div>
      <Bloco titulo={T.dosha.desequilibra} texto={carta.desequilibra} />
      <Bloco titulo={T.dosha.equilibra} texto={carta.equilibra} />
    </div>
  )
}

function Proporcao({ proporcao }: { proporcao: { dosha: Dosha; porcento: number }[] }) {
  const texto = (p: { dosha: Dosha; porcento: number }) =>
    formatar(T.dosha.proporcao, { n: p.porcento, Dosha: NOME[p.dosha] })
  const visiveis = proporcao.filter((p) => p.porcento > 0)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-paper-ink">{proporcao.map(texto).join(" · ")}</p>
      <div className="flex h-1 w-full overflow-hidden" aria-hidden="true">
        {visiveis.map((p) => (
          <span key={p.dosha} className={COR[p.dosha]} style={{ width: `${p.porcento}%` }} />
        ))}
      </div>
      <div className="flex text-caption text-paper-ink/80" aria-hidden="true">
        {visiveis.map((p) => (
          <span key={p.dosha} className="truncate" style={{ width: `${p.porcento}%` }}>
            {NOME[p.dosha]}
          </span>
        ))}
      </div>
    </div>
  )
}

function SemDosha({
  painel,
  aoMudar,
}: {
  painel: Extract<Painel, { tem: false }>
  aoMudar: () => void
}) {
  return (
    <Surface
      as="div"
      tone="paper"
      radius="card"
      shadow="lift"
      padding="lg"
      className="flex flex-col gap-5"
    >
      <Manchas doshas={["vata", "pitta", "kapha"]} size="sm" />
      <h3 className="font-title text-display font-medium">{T.semDosha.titulo}</h3>
      <p className="text-prose">{T.semDosha.texto}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {painel.linhas.map((linha) => (
          <li key={linha.dosha} className="text-body">
            <span className="font-semibold">{linha.nome}</span>
            {": "}
            {linha.resumo}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <LinkQuiz primario>{T.semDosha.quiz}</LinkQuiz>
        <Button variant="secondary" onPress={aoMudar}>
          {T.semDosha.jaSei}
        </Button>
      </div>
    </Surface>
  )
}

type Props = { painel: Painel; aoMudar: () => void }

export function CartaDoDosha({ painel, aoMudar }: Props) {
  return (
    <section aria-labelledby="voce-dosha-titulo">
      <h2 id="voce-dosha-titulo" className="sr-only">
        {T.dosha.titulo}
      </h2>
      {painel.tem ? (
        <ComDosha painel={painel} aoMudar={aoMudar} />
      ) : (
        <SemDosha painel={painel} aoMudar={aoMudar} />
      )}
    </section>
  )
}

function ComDosha({
  painel,
  aoMudar,
}: {
  painel: Extract<Painel, { tem: true }>
  aoMudar: () => void
}) {
  const misto = painel.cartas.length > 1
  const [principal] = painel.cartas
  return (
    <Surface
      as="div"
      tone="paper"
      radius="card"
      shadow="lift"
      padding="lg"
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-4">
        <Manchas doshas={painel.cartas.map((c) => c.dosha)} size={misto ? "md" : "lg"} />
        <div className="min-w-0">
          <p className="font-title text-display font-medium">{painel.nome}</p>
          {painel.origem === "declarado" ? (
            <p className="text-sm text-paper-ink/80">{T.dosha.escolhido}</p>
          ) : null}
        </div>
      </div>
      {painel.proporcao && painel.origem === "quiz" ? (
        <Proporcao proporcao={painel.proporcao} />
      ) : null}
      {misto ? (
        <Tabs className="[--ritu-ink-muted:var(--ritu-paper-ink)] [--ritu-ink:var(--ritu-paper-ink)]">
          <TabList aria-label={T.dosha.titulo}>
            {painel.cartas.map((c) => (
              <Tab key={c.dosha} id={c.dosha}>
                {c.nome}
              </Tab>
            ))}
          </TabList>
          {painel.cartas.map((c) => (
            <TabPanel key={c.dosha} id={c.dosha}>
              <ConteudoDaCarta carta={c} />
            </TabPanel>
          ))}
        </Tabs>
      ) : principal ? (
        <ConteudoDaCarta carta={principal} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <LinkQuiz primario={false}>{T.dosha.refazer}</LinkQuiz>
        <Button variant="secondary" onPress={aoMudar}>
          {T.dosha.mudar}
        </Button>
      </div>
    </Surface>
  )
}
