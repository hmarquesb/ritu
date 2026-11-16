// Histórico do eval com LLM: uma entrada por checkpoint, em `evals/resultados/historico.json` (spec 014).
import { z } from "zod"
import { checkpoints } from "../../../evals/llm/checkpoints"
import { avaliarMetas, type Meta } from "./metas"
import { calcularMetricas } from "./metricas"
import type { ResultadoDoCaso } from "./resultado"

export const historicoSchema = z.object({
  versao: z.literal(1),
  checkpoints: z.array(
    z.object({
      checkpoint: z.string(),
      data: z.string(),
      prompts: z.record(z.string(), z.string()),
      modelos: z.array(z.string()),
      casos: z.number().int(),
      casos_com_erro: z.number().int(),
      metricas: z.record(
        z.string(),
        z.object({
          valor: z.number().nullable(),
          parte: z.number().optional(),
          total: z.number().optional(),
        }),
      ),
      violacoes_da_1a: z.record(z.string(), z.number().int()),
      abaixo_da_meta: z.array(z.string()),
      criticas: z.array(z.string()),
    }),
  ),
})

export type Historico = z.infer<typeof historicoSchema>
export type EntradaDoHistorico = Historico["checkpoints"][number]

// Ordem dos checkpoints; nome fora da lista fica depois de todos.
const ordemDoCheckpoint = (nome: string): number => {
  const lista: string[] = Object.keys(checkpoints)
  const posicao = lista.indexOf(nome)
  return posicao === -1 ? lista.length : posicao
}

function violacoesDa1a(resultados: ResultadoDoCaso[]): Record<string, number> {
  const contagem: Record<string, number> = {}
  for (const resultado of resultados) {
    for (const codigo of resultado.run?.violacoesDa1a ?? []) {
      contagem[codigo] = (contagem[codigo] ?? 0) + 1
    }
  }
  return contagem
}

export function entradaDaRodada(p: {
  checkpoint: string
  data: string
  prompts: Record<string, string>
  resultados: ResultadoDoCaso[]
  metas: Record<string, Meta>
}): EntradaDoHistorico {
  const metricas = calcularMetricas(p.resultados)
  const { abaixo, criticas } = avaliarMetas(metricas, p.metas)
  return {
    checkpoint: p.checkpoint,
    data: p.data,
    prompts: p.prompts,
    modelos: [...new Set(p.resultados.flatMap((r) => r.modelos))].sort(),
    casos: p.resultados.length,
    casos_com_erro: p.resultados.filter((r) => r.erro !== undefined).length,
    metricas,
    violacoes_da_1a: violacoesDa1a(p.resultados),
    abaixo_da_meta: abaixo,
    criticas,
  }
}

/** Troca a entrada do mesmo checkpoint ou acrescenta; a ordem final é a de `checkpoints.ts`. */
export function trocarEntrada(h: Historico, e: EntradaDoHistorico): Historico {
  const outras = h.checkpoints.filter((entrada) => entrada.checkpoint !== e.checkpoint)
  const todas = [...outras, e].sort(
    (a, b) => ordemDoCheckpoint(a.checkpoint) - ordemDoCheckpoint(b.checkpoint),
  )
  return { ...h, checkpoints: todas }
}

/** A entrada do checkpoint imediatamente à esquerda em `checkpoints.ts` que exista no histórico. */
export function anteriorA(h: Historico, checkpoint: string): EntradaDoHistorico | undefined {
  const lista: string[] = Object.keys(checkpoints)
  for (let posicao = lista.indexOf(checkpoint) - 1; posicao >= 0; posicao--) {
    const achada = h.checkpoints.find((entrada) => entrada.checkpoint === lista[posicao])
    if (achada !== undefined) return achada
  }
  return undefined
}

/** Arquivo ausente vira histórico vazio; JSON ou schema inválido dá `ok: false`. */
export function lerHistorico(
  texto: string | undefined,
): { ok: true; historico: Historico } | { ok: false } {
  if (texto === undefined) return { ok: true, historico: { versao: 1, checkpoints: [] } }
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false }
  }
  const lido = historicoSchema.safeParse(bruto)
  return lido.success ? { ok: true, historico: lido.data } : { ok: false }
}

export const formatarHistorico = (h: Historico): string => `${JSON.stringify(h, null, 2)}\n`
