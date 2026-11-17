import { describe, expect, it } from "vitest"
import { z } from "zod"
import { conversaDoDia, visaoDoRunDaConta } from "@/core/conversation/do-dia"
import type { VisaoDoRun } from "@/core/conversation/visao"
import type { ModelRouter } from "@/core/llm/router"
import { CAMINHOS, STATUS_RUN } from "@/core/runs/ports"
import { getContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
  cenariosDeMemoria,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Campos que existem no run e no banco e não podem chegar à tela.
const CAMPOS_INTERNOS = ["linha_base", "citados", "checkpoint", "tokens", "modelo", "clima_usado"]

// Schema da visão, espelho de VisaoDoRun. Todo objeto é estrito: campo a mais é erro.
const pergunta = z.discriminatedUnion("tipo", [
  z.strictObject({
    tipo: z.literal("casa"),
    texto: z.string(),
    itens: z.array(z.strictObject({ alimento_id: z.string(), nome: z.string() })),
  }),
  z.strictObject({
    tipo: z.literal("come"),
    texto: z.string(),
    alimento_id: z.string(),
    nome: z.string(),
  }),
  z.strictObject({
    tipo: z.literal("variante"),
    texto: z.string(),
    incomodo: z.string(),
    opcoes: z.array(z.strictObject({ id: z.string(), texto: z.string() })),
  }),
])

const itemNaTela = z.strictObject({
  alimento_id: z.string(),
  nome: z.string(),
  verbos: z.array(z.string()),
  incerto: z.boolean(),
  troca: z.strictObject({ frase: z.string() }).optional(),
})

const sugestaoNaTela = z.strictObject({
  posicao: z.number().int().nonnegative(),
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  titulo: z.string(),
  como_fazer: z.string(),
  itens: z.array(itemNaTela),
  verbos: z.array(z.string()),
  motivo: z.string(),
  novidade: z.boolean(),
  aviso: z.string().optional(),
  podeTrocar: z.boolean(),
})

const visaoSchema: z.ZodType<VisaoDoRun> = z.strictObject({
  run_id: z.string(),
  status: z.enum(STATUS_RUN),
  caminho: z.enum(CAMINHOS),
  frases: z.array(z.strictObject({ chave: z.string(), texto: z.string() })),
  resposta: z.string().optional(),
  avisos: z.array(z.strictObject({ tipo: z.enum(["incomodo", "geral"]), texto: z.string() })),
  sugestoes: z.array(sugestaoNaTela),
  evitar: z.array(z.string()),
  para_ter: z
    .strictObject({
      nome: z.string(),
      vezes: z.number(),
      verbos: z.array(z.string()),
      motivo: z.string(),
    })
    .optional(),
  pergunta: z
    .strictObject({
      estado: z.enum(["aberta", "seguiu", "expirou", "respondida"]),
      pergunta,
    })
    .optional(),
  bloco: z
    .strictObject({
      estado: z.enum(["aberto", "anotado", "recusado", "seguiu", "expirou"]),
      linhas: z.array(
        z.strictObject({
          id: z.string(),
          texto: z.string(),
          decisao: z.enum(["pendente", "aprovada", "recusada", "expirada"]),
        }),
      ),
    })
    .optional(),
  voto: z.enum(["up", "down"]).optional(),
  geral: z.boolean(),
  podeVotar: z.boolean(),
})

// Todas as chaves do JSON, em qualquer profundidade (os valores não entram).
function chaves(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(chaves)
  if (valor !== null && typeof valor === "object") {
    return Object.entries(valor).flatMap(([chave, dentro]) => [chave, ...chaves(dentro)])
  }
  return []
}

// A visão vai para a tela como JSON: confere o JSON, não o objeto em memória.
function conferir(visao: VisaoDoRun) {
  const json: unknown = JSON.parse(JSON.stringify(visao))
  const lida = visaoSchema.safeParse(json)
  expect(lida.success, lida.success ? "" : lida.error.message).toBe(true)
  expect(chaves(json).filter((chave) => CAMPOS_INTERNOS.includes(chave))).toEqual([])
}

// Todos os cenários de conversa de test/fixtures/cenarios, rodados com o runtime roteirizado até o fim.
const TODOS: Record<string, CenarioDeConversa> = {
  ...cenariosDeConversa,
  ...cenariosComPausa,
  ...cenariosComAprovacao,
  ...cenariosDeAprendizado,
  ...cenariosDeMemoria,
  ...cenariosDeGuardrails,
}

describe.each(Object.entries(TODOS))("visão do cenário %s", (nome, c) => {
  it("a visão do run passa no tipo VisaoDoRun e não traz campo interno", async () => {
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    expect(run, nome).toBeDefined()
    if (!run) throw new Error(`${nome}: run final não encontrado`)

    const visao = await visaoDoRunDaConta(deps.stores, contaId, run, undefined, deps.clock.now())
    conferir(visao)
  })

  it("cada visão da conversa do dia passa no tipo VisaoDoRun e não traz campo interno", async () => {
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    const conta = await deps.stores.accounts.buscar(contaId)
    if (!conta) throw new Error(`${nome}: conta não encontrada`)
    const perfil = await deps.stores.profiles.ler(contaId)

    const dia = await conversaDoDia(
      {
        stores: deps.stores,
        clock: deps.clock,
        seed: getContainer().demoSeed,
        limiter: createMemoryLimiter(),
        router: { cotaDoDiaEsgotada: async () => false } as unknown as ModelRouter,
        telemetry: createMemoryTelemetry(),
      },
      conta,
      perfil,
      { ipHash: "h" },
    )
    for (const visao of Object.values(dia.runs)) conferir(visao)
  })
})
