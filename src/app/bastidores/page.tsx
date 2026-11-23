import { config, textosBastidores } from "@config/index"
import { headers } from "next/headers"
import Link from "next/link"
import { StateBlock } from "@/components/base/state-block"
import { Logo } from "@/components/brand/logo"
import { GraficoEvolucao } from "@/components/ritu/bastidores/grafico-evolucao"
import { NumerosDaSemana } from "@/components/ritu/bastidores/numeros-da-semana"
import { TabelaMetricas, type TabelaPronta } from "@/components/ritu/bastidores/tabela-metricas"
import { UseOMcp } from "@/components/ritu/bastidores/use-o-mcp"
import { formatarMetrica, montarEvolucao, rotuloDoGrafico } from "@/core/bastidores/evolucao"
import type { NumerosDaSemana as Numeros } from "@/core/bastidores/numeros"
import { DESCRICOES_PUBLICAS } from "@/core/mcp/tools"
import { getContainer } from "@/infra/container"

export const dynamic = "force-dynamic"

export const metadata = { title: "Bastidores · Ritu" }

const T = textosBastidores

async function lerNumeros(): Promise<Numeros | undefined> {
  try {
    return await getContainer().numerosDaSemana()
  } catch {
    return undefined
  }
}

async function origemDoPedido(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto.split(",")[0]?.trim()}://${host}`
}

function Evolucao() {
  const historico = getContainer().historico()
  if (historico === undefined) return <StateBlock kind="error" title={T.evals.erro} />
  const evolucao = montarEvolucao(historico, config.evals.metas)
  if (evolucao.tipo === "vazia") return <StateBlock kind="empty" title={T.evals.vazio} />
  const tabelaPronta: TabelaPronta = {
    checkpoints: evolucao.checkpoints,
    grupos: evolucao.tabela.map((grupo) => ({
      familia: grupo.familia,
      rotulo: grupo.rotulo,
      linhas: grupo.linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        celulas: l.valores.map((v) => ({
          texto: formatarMetrica(v.valor, l.formato),
          abaixo: v.abaixo,
        })),
      })),
    })),
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-body text-ink-muted">{T.evals.intro}</p>
      <div className="grid grid-cols-1 gap-4 min-[48rem]:grid-cols-2">
        {evolucao.graficos.map((g) => (
          <GraficoEvolucao
            key={g.id}
            grafico={g}
            rotulo={rotuloDoGrafico(g)}
            formatarMetrica={formatarMetrica}
          />
        ))}
      </div>
      <TabelaMetricas tabela={tabelaPronta} />
    </div>
  )
}

function Secao({
  id,
  titulo,
  children,
}: {
  id: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 border-t border-line pt-8">
      <h2 id={id} className="font-title text-title font-semibold text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default async function Bastidores() {
  const [numeros, origem] = await Promise.all([lerNumeros(), origemDoPedido()])
  const endereco = `${origem}${config.bastidores.mcp.caminho}`
  return (
    <>
      <header className="mx-auto flex w-full max-w-[64rem] items-center px-4 pt-5 min-[48rem]:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Logo variant="full" size="sm" />
        </Link>
      </header>
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 pb-12 pt-6 min-[48rem]:max-w-[64rem] min-[48rem]:px-6"
      >
        <div className="flex flex-col gap-3">
          <h1 className="font-title text-display font-medium text-ink">{T.titulo}</h1>
          <p className="max-w-prose text-prose text-ink-muted">{T.intro}</p>
        </div>
        <Secao id="semana" titulo={T.semana.titulo}>
          <NumerosDaSemana numeros={numeros} formatarMetrica={formatarMetrica} />
        </Secao>
        <Secao id="evals" titulo={T.evals.titulo}>
          <Evolucao />
        </Secao>
        <Secao id="mcp" titulo={T.mcp.titulo}>
          <UseOMcp endereco={endereco} tools={DESCRICOES_PUBLICAS} />
        </Secao>
      </main>
      <footer className="mx-auto w-full max-w-[64rem] px-4 pb-10 text-sm text-ink-muted min-[48rem]:px-6">
        {T.aviso}
      </footer>
    </>
  )
}
