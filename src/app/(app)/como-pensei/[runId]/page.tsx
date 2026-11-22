import { textosComoPensei } from "@config/index"
import { notFound } from "next/navigation"
import { StateBlock } from "@/components/base/state-block"
import { TextLink } from "@/components/base/text-link"
import { LinhaDoTempoNaTela } from "@/components/ritu/como-pensei/linha-do-tempo"
import { TotalDoRun } from "@/components/ritu/como-pensei/total"
import { getContainer } from "@/infra/container"
import { exigirPasso } from "../../../_lib/conta"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PaginaComoPensei({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const { conta } = await exigirPasso("pronto")
  if (!UUID.test(runId)) notFound()
  const linha = await getContainer().lerComoPensei(conta.id, runId)
  if (!linha) notFound()
  const T = textosComoPensei
  const voltar = <TextLink href="/conversa">{T.voltar}</TextLink>
  return (
    <article className="mx-auto w-full max-w-shell font-body">
      <header className="mb-6">
        <h1 className="font-title text-title font-semibold text-ink">{T.titulo}</h1>
        {linha.estado === "pronto" ? (
          <p className="mt-1 text-sm text-ink-muted">{linha.quando}</p>
        ) : null}
        <p className="mt-2 text-base">{voltar}</p>
      </header>
      {linha.estado === "aberto" ? (
        <StateBlock kind="waiting" title={T.aberto} action={voltar} />
      ) : linha.estado === "sem_rastro" ? (
        <StateBlock kind="empty" title={T.semRastro} action={voltar} />
      ) : (
        <>
          <LinhaDoTempoNaTela passos={linha.passos} />
          <TotalDoRun total={linha.total} />
        </>
      )}
    </article>
  )
}
