import { z } from "zod"
import { RituError } from "@/core/errors"
import { retornoNaTela } from "@/core/outcomes/visao"
import { acaoDaCasaSchema, acaoDaListaSchema } from "@/core/touches"
import type { Container } from "@/infra/container"
import { type Contexto, criarRota, type DepsDaRota } from "../_lib/rota"

const schemaDoGosto = z.strictObject({
  alimento_id: z.string().min(1).max(60),
  gosto: z.enum(["gosta", "nao_gosta"]).nullable(),
})

const schemaDoResultado = z.strictObject({
  resultado: z.enum(["ajudou", "nao_ajudou", "nao_fez"]),
})

const idDoRetorno = z.uuid()

type ParamsDoRetorno = { params: Promise<{ id: string }> }

// Nome da base; o toque já confirmou que o alimento existe, então o id é só a rede de segurança.
function nomeDoAlimento(container: Container, alimentoId: string): string {
  return container.knowledge.alimento(alimentoId)?.nome ?? alimentoId
}

// Rota com o `:id` do caminho: o id é lido antes do corpo ser usado, como em `rotaDoRun`.
function rotaDoRetorno<B, R>(
  deps: DepsDaRota,
  opts: { corpo?: z.ZodType<B> },
  fn: (ctx: Contexto<B>, id: string) => Promise<R>,
): (request: Request, contexto: ParamsDoRetorno) => Promise<Response> {
  return async (request, { params }) => {
    const { id } = await params
    return criarRota(deps, opts, (ctx) => fn(ctx, id))(request)
  }
}

export function rotasDaCasa(deps: DepsDaRota) {
  const lerCasa = criarRota(deps, {}, async ({ conta, container }) => ({
    casa: await container.lerCasa(conta.id),
  }))

  const tocarCasa = criarRota(
    deps,
    { corpo: acaoDaCasaSchema },
    async ({ conta, corpo, container }) => {
      const { nome } = await container.touches.tocarCasa(conta.id, corpo)
      return { casa: await container.lerCasa(conta.id), nome }
    },
  )

  const preferencias = criarRota(
    deps,
    { corpo: schemaDoGosto },
    async ({ conta, corpo, container }) => {
      await container.touches.tocarGosto(
        conta.id,
        { tipo: "alimento", id: corpo.alimento_id },
        corpo.gosto,
      )
      return {
        casa: await container.lerCasa(conta.id),
        nome: nomeDoAlimento(container, corpo.alimento_id),
      }
    },
  )

  const lista = criarRota(
    deps,
    { corpo: acaoDaListaSchema },
    async ({ conta, corpo, container }) => {
      const { nome } = await container.touches.tocarLista(conta.id, corpo)
      return { casa: await container.lerCasa(conta.id), nome }
    },
  )

  const lerRetornos = criarRota(deps, {}, async ({ conta, container }) => ({
    comoFicou: await container.lerComoFicou(conta.id),
  }))

  const responderRetorno = rotaDoRetorno(
    deps,
    { corpo: schemaDoResultado },
    async ({ conta, corpo, container }, id) => {
      const uuid = idDoRetorno.safeParse(id)
      if (!uuid.success) throw new RituError("toque_invalido", "Toque inválido")
      const retorno = await container.touches.tocarRetorno(conta.id, uuid.data, corpo.resultado)
      return {
        retorno: retornoNaTela(retorno, container.knowledge),
        pendentes: (await container.lerComoFicou(conta.id)).total,
      }
    },
  )

  return { lerCasa, tocarCasa, preferencias, lista, lerRetornos, responderRetorno }
}
