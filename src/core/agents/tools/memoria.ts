import { config } from "@config/index"
import { z } from "zod"
import { passaNoFiltro } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { Alimento } from "@/core/knowledge/schemas"
import { estadoSchema, grupoSchema, momentoDoDiaSchema } from "@/core/knowledge/vocab"
import { type EstadoCalculado, estadoDoItem } from "@/core/pantry/estado"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { Run } from "@/core/runs/ports"
import { definirTool, type Tool, type ToolContext } from "./tool"

const DIA_EM_MS = 86_400_000
const DIAS_DO_HISTORICO = 7

const entradaVaziaSchema = z.object({}).strict()

const tipoDeItemSchema = z.enum(["alimento", "pratica", "preparo"])

// casa.ler

const itemCasaSchema = z.object({
  alimento_id: z.string().nullable(),
  nome: z.string(),
  grupo: grupoSchema.nullable(),
  estado: z.enum(["confirmado", "incerto", "sempre_tenho"]),
  dias_desde_confirmacao: z.number(),
  conhecido: z.boolean(),
})

const casaSaidaSchema = z.object({
  itens: z.array(itemCasaSchema),
  confirmados: z.number(),
  incertos: z.number(),
})

type ItemCasaLido = z.infer<typeof itemCasaSchema>

function diasDesde(item: ItemDaCasa, agora: Date): number {
  return Math.floor((agora.getTime() - Date.parse(item.confirmado_em)) / DIA_EM_MS)
}

// Alimento da base sai pelo filtro, só pelo motivo evitar sempre.
// Nome livre sai quando contém um texto que a pessoa pediu para evitar.
function passaNaCasa(item: ItemDaCasa, alimento: Alimento | undefined, ctx: ToolContext): boolean {
  if (!alimento) return !evitadoPorTexto(item.nome_livre ?? "", ctx)
  const veredito = passaNoFiltro(alimento, ctx.filtro, ctx.kb)
  return veredito.passa || veredito.motivo !== "evitar_sempre"
}

function evitadoPorTexto(nome: string, ctx: ToolContext): boolean {
  const nomeNormalizado = normalizar(nome)
  return ctx.filtro.evitar.some(
    (item) => item.tipo === "texto" && nomeNormalizado.includes(normalizar(item.valor)),
  )
}

function lerItemDaCasa(item: ItemDaCasa, ctx: ToolContext, agora: Date): ItemCasaLido | undefined {
  const alimento = item.alimento_id === null ? undefined : ctx.kb.alimento(item.alimento_id)
  const estado: EstadoCalculado = estadoDoItem(item, agora, alimento?.durabilidade)
  if (estado === "acabou" || !passaNaCasa(item, alimento, ctx)) return undefined
  return {
    alimento_id: item.alimento_id,
    nome: alimento?.nome ?? item.nome_livre ?? item.nome_normalizado ?? "",
    grupo: alimento?.grupo ?? null,
    estado,
    dias_desde_confirmacao: diasDesde(item, agora),
    conhecido: item.alimento_id !== null,
  }
}

// Grupo em ordem alfabética, nulos no fim; depois o nome.
function compararItens(a: ItemCasaLido, b: ItemCasaLido): number {
  if (a.grupo !== b.grupo) {
    if (a.grupo === null) return 1
    if (b.grupo === null) return -1
    return a.grupo.localeCompare(b.grupo)
  }
  return a.nome.localeCompare(b.nome, "pt-BR")
}

export const casaLerTool = definirTool({
  name: "casa.ler",
  description:
    "Leia o que a pessoa tem em casa, com o estado de cada item (confirmado, incerto ou sempre tenho). Itens que acabaram e os que ela pediu para evitar não aparecem.",
  input: entradaVaziaSchema,
  output: casaSaidaSchema,
  async executar(_entrada, ctx) {
    const agora = ctx.clock.now()
    const itens = await ctx.stores.pantry.listar(ctx.contaId)
    const lidos = itens
      .map((item) => lerItemDaCasa(item, ctx, agora))
      .filter((item): item is ItemCasaLido => item !== undefined)
      .sort(compararItens)
    const incertos = lidos.filter((item) => item.estado === "incerto").length
    return { itens: lidos, confirmados: lidos.length - incertos, incertos }
  },
})

// preferencias.ler

const itemReferenciadoSchema = z.object({ tipo: tipoDeItemSchema, id: z.string() }).strict()

const preferenciasEntradaSchema = z
  .object({ itens: z.array(itemReferenciadoSchema).min(1).max(10) })
  .strict()

const preferenciasSaidaSchema = z.object({
  itens: z.array(
    z.object({
      tipo: tipoDeItemSchema,
      id: z.string(),
      gosto: z.enum(["gosta", "nao_gosta"]).nullable(),
      ajudou: z.number(),
      nao_ajudou: z.number(),
      nao_fez: z.number(),
    }),
  ),
})

export const preferenciasLerTool = definirTool({
  name: "preferencias.ler",
  description:
    "Leia as preferências já registradas para alguns alimentos, práticas ou preparos: se gosta, e quantas vezes ajudou, não ajudou ou não foi feito. Itens sem registro não aparecem.",
  input: preferenciasEntradaSchema,
  output: preferenciasSaidaSchema,
  async executar(entrada, ctx) {
    const lidas = await ctx.stores.preferences.ler(ctx.contaId, entrada.itens)
    return {
      itens: lidas.map((p) => ({
        tipo: p.item_tipo,
        id: p.item_id,
        gosto: p.gosto,
        ajudou: p.ajudou,
        nao_ajudou: p.nao_ajudou,
        nao_fez: p.nao_fez,
      })),
    }
  },
})

// historico.recente

const historicoEntradaSchema = z
  .object({ dias: z.number().int().min(1).max(DIAS_DO_HISTORICO).optional() })
  .strict()

const resultadoDaSugestaoSchema = z.enum(["ajudou", "nao_ajudou", "nao_fez", "aguardando"])

const linhaDoRunSchema = z.object({
  dia: z.string(),
  momento_do_dia: momentoDoDiaSchema,
  estados: z.array(estadoSchema),
  sugestoes: z.array(z.object({ titulo: z.string(), resultado: resultadoDaSugestaoSchema })),
})

const historicoSaidaSchema = z.object({ runs: z.array(linhaDoRunSchema) })

type LinhaDoRun = z.infer<typeof linhaDoRunSchema>

// Só o momento e as sugestões: a mensagem da pessoa nunca entra aqui.
async function linhaDoRun(run: Run, ctx: ToolContext): Promise<LinhaDoRun | undefined> {
  if (!run.momento) return undefined
  const retornos = await ctx.stores.outcomes.doRun(ctx.contaId, run.id)
  return {
    dia: run.dia,
    momento_do_dia: run.momento.momento_do_dia,
    estados: run.momento.estados,
    sugestoes: retornos.map((r) => ({
      titulo: r.sugestao.titulo,
      resultado: r.resultado ?? "aguardando",
    })),
  }
}

export const historicoRecenteTool = definirTool({
  name: "historico.recente",
  description:
    "Leia os momentos e as sugestões dos últimos dias (até 7), com o que a pessoa disse de cada uma: ajudou, não ajudou, não fez ou ainda aguardando. Não traz o texto da conversa.",
  input: historicoEntradaSchema,
  output: historicoSaidaSchema,
  async executar(entrada, ctx) {
    const dias = entrada.dias ?? DIAS_DO_HISTORICO
    const desde = new Date(ctx.clock.now().getTime() - dias * DIA_EM_MS)
    const runs = await ctx.stores.runs.recentes(ctx.contaId, desde, config.memoria.historicoLinhas)
    const linhas = await Promise.all(runs.map((run) => linhaDoRun(run, ctx)))
    return { runs: linhas.filter((linha): linha is LinhaDoRun => linha !== undefined) }
  },
})

export const memoriaTools: Tool<unknown, unknown>[] = [
  casaLerTool,
  preferenciasLerTool,
  historicoRecenteTool,
]
