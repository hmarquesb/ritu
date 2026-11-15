import { z } from "zod"
import { gunaSchema } from "@/core/knowledge/vocab"
import type { CidadeDaPessoa, Clima } from "@/core/weather/ports"
import { climaEmQualidades } from "@/core/weather/qualidades"
import { tendenciaDasProximasHoras } from "@/core/weather/tendencia"
import { definirTool, type Tool, type ToolContext } from "./tool"

const entradaSchema = z.object({}).strict()

const semCidadeSchema = z.object({ status: z.literal("sem_cidade") })
const indisponivelSchema = z.object({ status: z.literal("indisponivel") })

const agoraSaidaSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    cidade: z.string(),
    temperatura_aparente: z.number(),
    umidade: z.number(),
    faixa_temperatura: z.enum(["frio", "neutro", "quente"]),
    faixa_umidade: z.enum(["seco", "neutro", "umido"]),
    gunas: z.array(gunaSchema),
    observado_em: z.string(),
  }),
  semCidadeSchema,
  indisponivelSchema,
])

const proximasHorasSaidaSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    cidade: z.string(),
    temperatura: z.enum(["esquenta", "esfria", "estavel"]),
    chuva: z.boolean(),
    ate: z.string(),
  }),
  semCidadeSchema,
  indisponivelSchema,
])

const umaCasa = (n: number): number => Math.round(n * 10) / 10

// Erro de qualquer tipo vira "indisponivel": a tool nunca lança por causa do clima.
async function climaDaCidade(ctx: ToolContext, cidade: CidadeDaPessoa): Promise<Clima | undefined> {
  try {
    return await ctx.clima.fonte.buscar({ lat: cidade.lat, lon: cidade.lon })
  } catch {
    return undefined
  }
}

export const climaAgoraTool = definirTool({
  name: "clima.agora",
  description:
    "Consulte a temperatura aparente e a umidade da cidade da pessoa, já em qualidades. Faz sentido em mensagens de momento; é dispensável em pergunta conceitual.",
  input: entradaSchema,
  output: agoraSaidaSchema,
  async executar(_entrada, ctx) {
    const cidade = ctx.clima.cidade
    if (!cidade) return { status: "sem_cidade" }
    const clima = await climaDaCidade(ctx, cidade)
    if (!clima) return { status: "indisponivel" }
    return {
      status: "ok",
      cidade: cidade.nome,
      temperatura_aparente: umaCasa(clima.temperatura_aparente),
      umidade: Math.round(clima.umidade),
      ...climaEmQualidades(clima),
      observado_em: clima.observado_em,
    }
  },
})

export const climaProximasHorasTool = definirTool({
  name: "clima.proximas_horas",
  description:
    "Consulte a tendência das próximas 6 horas (esquenta, esfria, chove). Só quando a ação é para mais tarde ou depende de sair de casa.",
  input: entradaSchema,
  output: proximasHorasSaidaSchema,
  async executar(_entrada, ctx) {
    const cidade = ctx.clima.cidade
    if (!cidade) return { status: "sem_cidade" }
    const clima = await climaDaCidade(ctx, cidade)
    if (!clima) return { status: "indisponivel" }
    return { status: "ok", cidade: cidade.nome, ...tendenciaDasProximasHoras(clima) }
  },
})

export const climaTools: Tool<unknown, unknown>[] = [climaAgoraTool, climaProximasHorasTool]
