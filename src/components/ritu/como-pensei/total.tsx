import { textosComoPensei } from "@config/index"
import type { TotalDoRun as Total } from "@/core/como-pensei/linha-do-tempo"

const T = textosComoPensei.tecnico

const formatarNumero = new Intl.NumberFormat("pt-BR")

function segundos(ms: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(ms / 1000)} s`
}

export function TotalDoRun({ total }: { total: Total }) {
  const linhas: [string, string][] = [
    [T.passos, formatarNumero.format(total.passos)],
    [T.tempoTotal, segundos(total.latencia_ms)],
    [
      T.tokens,
      `${formatarNumero.format(total.tokens_entrada)} / ${formatarNumero.format(total.tokens_saida)}`,
    ],
    ...total.modelos.map((m): [string, string] => [
      `${T.modelosPorPapel}: ${m.papel}`,
      m.modelos.join(", "),
    ]),
    [T.trocas, formatarNumero.format(total.trocas_de_modelo)],
    ...(total.prompt_versao ? [[T.versaoDoPrompt, total.prompt_versao] as [string, string]] : []),
    [T.tentativasDaRevisao, formatarNumero.format(total.juiz_tentativas)],
  ]
  return (
    <details className="group mt-8 rounded-lg bg-sunken px-4 py-3 font-body text-sm text-ink">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm text-ink [&::-webkit-details-marker]:hidden">
        <span className="underline underline-offset-4 decoration-1">
          {textosComoPensei.detalhesDoRun}
        </span>
      </summary>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 tabular-nums">
        {linhas.map(([nome, valor]) => (
          <div key={nome} className="col-span-2 grid grid-cols-subgrid border-t border-line pt-2">
            <dt className="text-ink-muted">{nome}</dt>
            <dd className="text-right">{valor}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
