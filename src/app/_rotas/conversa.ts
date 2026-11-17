import { z } from "zod"
import { conversaDoDia } from "@/core/conversation/do-dia"
import { type VisaoDoRun, visaoDoRun } from "@/core/conversation/visao"
import { RituError } from "@/core/errors"
import type { Run } from "@/core/runs/ports"
import type { Container } from "@/infra/container"
import { type Contexto, criarRota, type DepsDaRota } from "../_lib/rota"

const idDoRun = z.uuid()

const motivoDaTroca = z.enum(["trocar", "nao_tenho", "nao_gosto"])
const posicaoDaSugestao = z.number().int().nonnegative()

const schemaDaTroca = z.strictObject({
  sugestao: posicaoDaSugestao,
  alimento_id: z.string().min(1),
  motivo: motivoDaTroca,
})

const schemaDaRespostaDaTroca = z.strictObject({
  sugestao: posicaoDaSugestao,
  alimento_id: z.string().min(1),
  candidato: z.string().min(1),
  resposta: z.enum(["tenho", "nao_tenho"]),
})

const schemaDoVoto = z.strictObject({ voto: z.enum(["up", "down"]) })

function schemaDaAprovacao(container: Container) {
  return z.strictObject({
    aprovadas: z.array(z.string().min(1)).max(container.config.aprovacao.maxLinhas),
  })
}

// Run da conta; id inválido, inexistente ou de outra conta é o mesmo 404, antes de qualquer serviço.
export async function runDaConta(container: Container, contaId: string, id: string): Promise<Run> {
  const uuid = idDoRun.safeParse(id)
  const run = uuid.success ? await container.stores.runs.buscar(contaId, uuid.data) : undefined
  if (!run) throw new RituError("run_nao_encontrado", "Conversa não encontrada")
  return run
}

// A visão é sempre relida do banco, depois de cada toque.
async function visaoDe(container: Container, contaId: string, runId: string): Promise<VisaoDoRun> {
  const { stores, clock } = container
  const run = await runDaConta(container, contaId, runId)
  const [etapas, propostas, retornos, votos] = await Promise.all([
    stores.runs.etapas(contaId, run.id),
    stores.proposals.doRun(contaId, run.id),
    stores.outcomes.doRun(contaId, run.id),
    stores.runs.votos(contaId, [run.id]),
  ])
  const voto = votos[run.id]
  return visaoDoRun({
    run,
    etapas,
    propostas,
    retornos,
    agora: clock.now(),
    ...(voto ? { voto } : {}),
  })
}

async function pendentesDa(container: Container, contaId: string): Promise<number> {
  return (await container.stores.outcomes.pendentes(contaId)).length
}

type ParamsDoRun = { params: Promise<{ id: string }> }

// Rota com o run do caminho: o run é lido da conta antes do corpo ser usado.
function rotaDoRun<B, R>(
  deps: DepsDaRota,
  opts: { corpo?: z.ZodType<B> },
  fn: (ctx: Contexto<B> & { run: Run }) => Promise<R>,
): (request: Request, contexto: ParamsDoRun) => Promise<Response> {
  return async (request, { params }) => {
    const { id } = await params
    return criarRota(deps, opts, async (ctx) =>
      fn({ ...ctx, run: await runDaConta(ctx.container, ctx.conta.id, id) }),
    )(request)
  }
}

export function rotasDaConversa(deps: DepsDaRota) {
  const conversa = criarRota(deps, {}, async ({ conta, container }) => {
    const perfil = await container.stores.profiles.ler(conta.id)
    return conversaDoDia(
      { stores: container.stores, clock: container.clock, seed: container.demoSeed },
      conta,
      perfil,
    )
  })

  const run = rotaDoRun(deps, {}, async ({ conta, container, run }) => ({
    visao: await visaoDe(container, conta.id, run.id),
    pendentes: await pendentesDa(container, conta.id),
  }))

  const aprovacao = rotaDoRun(
    deps,
    { corpo: schemaDaAprovacao(deps.container) },
    async ({ conta, corpo, container, run }) => {
      if (new Set(corpo.aprovadas).size !== corpo.aprovadas.length) {
        throw new RituError("aprovacao_invalida", "Há linhas repetidas na aprovação")
      }
      await container.conversation.aprovar(conta.id, run.id, corpo.aprovadas)
      return { visao: await visaoDe(container, conta.id, run.id) }
    },
  )

  const troca = rotaDoRun(
    deps,
    { corpo: schemaDaTroca },
    async ({ conta, corpo, container, run }) => {
      const resultado = await container.touches.trocarIngrediente(conta.id, {
        runId: run.id,
        ...corpo,
      })
      return { resultado, visao: await visaoDe(container, conta.id, run.id) }
    },
  )

  const respostaDaTroca = rotaDoRun(
    deps,
    { corpo: schemaDaRespostaDaTroca },
    async ({ conta, corpo, container, run }) => {
      const resultado = await container.touches.responderTroca(conta.id, {
        runId: run.id,
        ...corpo,
      })
      return { resultado, visao: await visaoDe(container, conta.id, run.id) }
    },
  )

  const voto = rotaDoRun(
    deps,
    { corpo: schemaDoVoto },
    async ({ conta, corpo, container, run }) => {
      await container.touches.tocarVoto(conta.id, run.id, corpo.voto)
      return { voto: corpo.voto }
    },
  )

  return { conversa, run, aprovacao, troca, respostaDaTroca, voto }
}
