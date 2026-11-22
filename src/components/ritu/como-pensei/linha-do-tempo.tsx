import { textosComoPensei } from "@config/index"
import type { Icon } from "@phosphor-icons/react"
import {
  ArrowsClockwise,
  BookOpen,
  ChatCircleText,
  CheckCircle,
  CloudSun,
  Flag,
  HandPointing,
  House,
  Leaf,
  Notebook,
  NotePencil,
  Question,
  Scales,
  ShieldCheck,
  Swap,
  WarningCircle,
} from "@phosphor-icons/react/ssr"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"
import type { PassoNaTela, TipoDoPasso } from "@/core/como-pensei/linha-do-tempo"

const T = textosComoPensei
const TT = textosComoPensei.tecnico

const ICONES: Record<TipoDoPasso, Icon> = {
  entendi: ChatCircleText,
  cuidado: ShieldCheck,
  clima: CloudSun,
  casa: House,
  lembrei: BookOpen,
  base: Leaf,
  retorno: ArrowsClockwise,
  conferi: CheckCircle,
  perguntei: Question,
  propus: NotePencil,
  aprovacao: HandPointing,
  memoria: Notebook,
  revisao: Scales,
  troca: Swap,
  erro: WarningCircle,
  fim: Flag,
}

const formatarNumero = new Intl.NumberFormat("pt-BR")

function detalhesTecnicos(t: PassoNaTela["tecnico"]): [string, string][] {
  const linhas: [string, string][] = []
  if (t.modelo) linhas.push([TT.modelo, t.modelo])
  if (t.tokens_entrada !== undefined || t.tokens_saida !== undefined) {
    linhas.push([
      TT.tokens,
      `${formatarNumero.format(t.tokens_entrada ?? 0)} / ${formatarNumero.format(t.tokens_saida ?? 0)}`,
    ])
  }
  if (t.duracao_ms !== undefined) {
    linhas.push([TT.tempo, `${formatarNumero.format(Math.round(t.duracao_ms))} ms`])
  }
  return linhas
}

function Passo({ passo, ultimo }: { passo: PassoNaTela; ultimo: boolean }) {
  const Glyph = ICONES[passo.tipo]
  const tecnicos = detalhesTecnicos(passo.tecnico)
  const falhou = passo.marca === "falhou"
  const corrigido = passo.marca === "corrigido"
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <span
        className={cx(
          "z-10 flex shrink-0 items-center justify-center rounded-pill text-ink ring-1 ring-line-strong",
          ultimo ? "size-10" : "mx-1 size-8",
          falhou ? "bg-danger-soft" : corrigido ? "bg-amber-soft" : "bg-surface",
        )}
      >
        <Glyph weight="light" size={ultimo ? ICON.lg : ICON.md} aria-hidden="true" />
      </span>
      <div className="min-w-0 max-w-prose flex-1 pt-1 font-body">
        <p className="text-base text-ink">{passo.frase}</p>
        {passo.detalhe ? <p className="mt-1 text-sm text-ink-muted">{passo.detalhe}</p> : null}
        {passo.marca ? (
          <p className={cx("mt-1 text-sm font-medium", falhou ? "text-danger" : "text-amber-ink")}>
            {falhou ? T.falhou : T.corrigido}
          </p>
        ) : null}
        {tecnicos.length > 0 ? (
          <details className="mt-1 text-sm text-ink">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm [&::-webkit-details-marker]:hidden">
              <span className="text-ink-muted underline underline-offset-4 decoration-1">
                {T.detalhes}
              </span>
            </summary>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 pb-2 tabular-nums">
              {tecnicos.map(([nome, valor]) => (
                <div key={nome} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="text-ink-muted">{nome}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  )
}

export function LinhaDoTempoNaTela({ passos }: { passos: PassoNaTela[] }) {
  return (
    <ol className="relative list-none p-0">
      <span
        aria-hidden="true"
        className="absolute bottom-5 left-5 top-4 w-px -translate-x-1/2 bg-line-strong"
      />
      {passos.map((passo, i) => (
        <Passo key={i} passo={passo} ultimo={i === passos.length - 1} />
      ))}
    </ol>
  )
}
