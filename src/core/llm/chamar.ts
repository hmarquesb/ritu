import { llmCotas, type Papel } from "@config/llm-cotas"
import type { z } from "zod"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { SpanAtivo, Telemetry } from "@/core/telemetry/ports"
import type { LlmClient } from "./client"
import { LlmError } from "./errors"
import type { ModelRouter, Troca } from "./router"

export class SemModeloError extends RituError {
  constructor(message = "Nenhum modelo disponível para o papel") {
    super("sem_modelo", message)
    this.name = "SemModeloError"
  }
}

type Tokens = { entrada: number; saida: number }

type Pedido<T> = {
  papel: Papel
  instrucoes: string
  entrada: string
  schema: z.ZodType<T>
  preferir?: string
  aoTrocar?: (t: Troca) => void
}

type Resultado<T> = { dado: T; modelo: string; tokens: Tokens; trocas: number; tentativas: number }

type Fornecedor = ReturnType<ModelRouter["paraPapel"]>

/** Uma chamada ao modelo: devolve o resultado, ou o LlmError que permite nova volta. */
async function tentar<T>(
  client: LlmClient,
  clock: Clock,
  fornecedor: Fornecedor,
  modelo: string,
  p: Pedido<T>,
): Promise<{ ok: { dado: T; tokens: Tokens } } | { erro: LlmError }> {
  try {
    const inicio = clock.now().getTime()
    const { dado, tokens } = await client.gerar({
      modelo,
      instrucoes: p.instrucoes,
      entrada: p.entrada,
      schema: p.schema,
      timeoutMs: llmCotas.timeoutMs,
    })
    await fornecedor.usou(modelo, tokens, clock.now().getTime() - inicio)
    return { ok: { dado, tokens } }
  } catch (e) {
    if (!(e instanceof LlmError)) throw e
    await fornecedor.falhou(modelo, e)
    return { erro: e }
  }
}

function deveRepetir(erro: LlmError, invalidas: number): boolean {
  return erro.code === "rate_limit" || (erro.code === "resposta_invalida" && invalidas < 2)
}

type Deps = { router: ModelRouter; client: LlmClient; telemetry: Telemetry; clock: Clock }

async function executar<T>(deps: Deps, p: Pedido<T>, span: SpanAtivo): Promise<Resultado<T>> {
  const { router, client, clock } = deps
  const fornecedor = router.paraPapel(p.papel, { preferir: p.preferir, aoTrocar: p.aoTrocar })
  const maxVoltas = llmCotas.papeis[p.papel].length + 2
  let trocas = 0
  let tentativas = 0
  let invalidas = 0

  for (let volta = 0; volta < maxVoltas; volta++) {
    const escolha = await fornecedor.proximo()
    if (!escolha) break
    if (escolha.troca) trocas++
    tentativas++
    const r = await tentar(client, clock, fornecedor, escolha.modelo, p)
    span.atribuir({
      "gen_ai.request.model": escolha.modelo,
      "llm.tentativas": tentativas,
      "llm.troca_de_modelo": trocas > 0,
    })
    if ("ok" in r) {
      const { dado, tokens } = r.ok
      span.atribuir({
        "gen_ai.usage.input_tokens": tokens.entrada,
        "gen_ai.usage.output_tokens": tokens.saida,
      })
      return { dado, modelo: escolha.modelo, tokens, trocas, tentativas }
    }
    if (r.erro.code === "resposta_invalida") invalidas++
    if (!deveRepetir(r.erro, invalidas)) throw r.erro
  }
  span.atribuir({ "llm.tentativas": tentativas, "llm.troca_de_modelo": trocas > 0 })
  throw new SemModeloError()
}

export function chamarComPapel<T>(deps: Deps, p: Pedido<T>): Promise<Resultado<T>> {
  return deps.telemetry.span("llm.chamada", { "llm.papel": p.papel }, (span) =>
    executar(deps, p, span),
  )
}
