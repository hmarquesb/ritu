import { z } from "zod"
import {
  alimentoTool,
  candidatosTool,
  checarCombinacaoTool,
  substitutosTool,
} from "@/core/agents/tools/ayurveda"
import { climaAgoraTool, climaProximasHorasTool } from "@/core/agents/tools/clima"
import type { Prakriti } from "@/core/knowledge/adequacao"
import { doshaSchema } from "@/core/knowledge/vocab"
import type { ToolContext } from "@/core/tools/tool"
import { type Cidade, CityLookupUnavailableError } from "@/core/weather/ports"
import { contextoPublico, type DepsPublicas } from "./contexto"

export const AVISO = "Não é orientação médica." as const
export const FONTE_CLIMA = "Open-Meteo (CC BY 4.0)" as const

export type ToolPublica<I, O> = {
  nome: string
  descricao: string
  curta: string
  entrada: z.ZodType<I>
  saida: z.ZodType<O>
  executar(e: I, deps: DepsPublicas): Promise<O>
}

// Entrada e saída são validadas aqui; a lógica vem das tools internas, sem reescrita.
function definirPublica<I, O>(def: {
  nome: string
  descricao: string
  curta: string
  entrada: z.ZodType<I>
  saida: z.ZodType<O>
  logica(e: I, deps: DepsPublicas): Promise<unknown>
}): ToolPublica<I, O> {
  return {
    nome: def.nome,
    descricao: def.descricao,
    curta: def.curta,
    entrada: def.entrada,
    saida: def.saida,
    async executar(e, deps) {
      const dados = def.entrada.parse(e)
      return def.saida.parse(await def.logica(dados, deps))
    },
  }
}

// Os schemas públicos saem dos internos (`Tool.input` e `Tool.output`): nenhum campo é redeclarado.
// Erro aqui é de programação: a tool interna mudou de forma.

function objetoDe(schema: z.ZodType): z.ZodObject {
  if (schema instanceof z.ZodObject) return schema
  throw new Error("schema interno esperado: objeto")
}

function campoDe(schema: z.ZodType, nome: string): z.ZodType {
  const campo = objetoDe(schema).shape[nome]
  if (!campo) throw new Error(`campo interno ausente: ${nome}`)
  return campo as z.ZodType
}

function elementoDe(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodArray) return schema.element as z.ZodType
  throw new Error("schema interno esperado: lista")
}

// Schema interno com campos a mais (ou trocados); o tipo é o da interna mais o que se acrescenta.
function comCampos<T, S extends z.ZodRawShape>(
  base: z.ZodType<T>,
  extra: S,
): z.ZodType<T & z.infer<z.ZodObject<S>>> {
  return objetoDe(base).extend(extra) as z.ZodType<T & z.infer<z.ZodObject<S>>>
}

// Mesmo schema interno com a descrição de cada campo (vai para o cliente MCP).
function descrever<T>(base: z.ZodType<T>, textos: Record<string, string>): z.ZodRawShape {
  return Object.fromEntries(
    Object.entries(textos).map(([nome, texto]) => [nome, campoDe(base, nome).describe(texto)]),
  )
}

const avisoSaida = z.literal(AVISO)

// ayurveda_alimento

const ayurvedaAlimento = definirPublica({
  nome: "ayurveda_alimento",
  descricao:
    "Qualidades (gunas), sabores (rasa), potência (virya), efeito pós-digestivo (vipaka), efeito nos doshas e como equilibrar de até 5 alimentos, pelo nome em português.",
  curta: "Qualidades e efeito de um alimento",
  entrada: comCampos(
    alimentoTool.input,
    descrever(alimentoTool.input, {
      alimentos: "Nomes de até 5 alimentos, em português, como a pessoa diria.",
    }),
  ),
  saida: comCampos(alimentoTool.output, { aviso: avisoSaida }),
  async logica(e, deps) {
    const r = await alimentoTool.execute(e, contextoPublico(deps))
    return { ...r, aviso: AVISO }
  },
})

// ayurveda_candidatos

const ayurvedaCandidatos = definirPublica({
  nome: "ayurveda_candidatos",
  descricao:
    "Alimentos, preparos ou práticas da base que atendem às qualidades buscadas, ordenados por adequação. Opcional: momento do dia, estados, função e o dosha da pessoa.",
  curta: "Sugestões para as qualidades que você busca",
  entrada: comCampos(candidatosTool.input, {
    ...descrever(candidatosTool.input, {
      tipo: "O que buscar: alimento, preparo ou prática.",
      buscadas: "Qualidades (gunas) que a pessoa busca, de 1 a 6.",
      momento_do_dia: "Momento do dia; só entram os itens que servem nele.",
      estados: "Estados da pessoa; os itens contraindicados para eles saem.",
      funcao: "Função que o item deve cumprir.",
      limite: "Quantos devolver, de 1 a 10.",
    }),
    dosha: doshaSchema
      .optional()
      .describe("Dosha da pessoa; a ordem leva em conta o efeito nesse dosha."),
  }),
  saida: comCampos(candidatosTool.output, { aviso: avisoSaida }),
  async logica({ dosha, ...resto }, deps) {
    const prakriti: Prakriti | undefined = dosha ? { [dosha]: 1 } : undefined
    const r = await candidatosTool.execute(resto, contextoPublico(deps, { prakriti }))
    return { ...r, aviso: AVISO }
  },
})

// ayurveda_substitutos

// Substituto sem em_casa: a pessoa não tem a despensa aqui, então o campo não vai ao cliente MCP.
const substitutoPublico = objetoDe(elementoDe(campoDe(substitutosTool.output, "substitutos"))).omit(
  { em_casa: true },
)

const ayurvedaSubstitutos = definirPublica({
  nome: "ayurveda_substitutos",
  descricao: "Substitutos para um alimento, com as qualidades em comum e o motivo.",
  curta: "Substitutos de um ingrediente",
  entrada: comCampos(
    substitutosTool.input,
    descrever(substitutosTool.input, {
      alimento_id: "Id do alimento que a pessoa não tem ou não quer.",
      funcao: "Função que o substituto deve cumprir.",
      preparo_id: "Id do preparo em que ele entra.",
      outros_itens: "Outros itens da receita, para não sugerir algo que conflite.",
      limite: "Quantos devolver, de 1 a 5.",
    }),
  ),
  saida: comCampos(substitutosTool.output, {
    substitutos: z.array(substitutoPublico),
    aviso: avisoSaida,
  }),
  async logica(e, deps) {
    // O schema público não tem em_casa; o parse tira o campo.
    const r = await substitutosTool.execute(e, contextoPublico(deps))
    return { ...r, aviso: AVISO }
  },
})

// ayurveda_checar_combinacao

const ayurvedaChecarCombinacao = definirPublica({
  nome: "ayurveda_checar_combinacao",
  descricao:
    "Confere se os alimentos combinam entre si pela base (combinações a evitar), com o motivo de cada conflito.",
  curta: "Se os alimentos combinam",
  entrada: comCampos(
    checarCombinacaoTool.input,
    descrever(checarCombinacaoTool.input, {
      itens: "Ids ou nomes dos alimentos da sugestão, de 2 a 8.",
    }),
  ),
  saida: comCampos(checarCombinacaoTool.output, { aviso: avisoSaida }),
  async logica(e, deps) {
    const r = await checarCombinacaoTool.execute(e, contextoPublico(deps))
    return { ...r, aviso: AVISO }
  },
})

// clima
// As saídas de clima são por extenso na spec (união por status); a entrada é só a cidade.

const cidadeEntrada = z.object({
  cidade: z
    .string()
    .min(2)
    .max(80)
    .refine((c) => c === c.trim(), "Sem espaço no início ou no fim.")
    .describe("Nome da cidade, como a pessoa diria."),
})

// A parte "ok" vem da saída interna (nenhum campo é redeclarado); a pública acrescenta região, país e fonte.
export function opcaoOk(schema: z.ZodType): z.ZodObject {
  if (!(schema instanceof z.ZodDiscriminatedUnion))
    throw new Error("schema interno esperado: união")
  const ok = schema.options.find(
    (o) => objetoDe(o as z.ZodType).shape.status?.def.values[0] === "ok",
  )
  if (!ok) throw new Error("schema interno esperado: opção ok")
  return objetoDe(ok as z.ZodType)
}

function saidaDeClima(interna: z.ZodType) {
  return z.discriminatedUnion("status", [
    opcaoOk(interna).extend({
      regiao: z.string().optional(),
      pais: z.string(),
      fonte: z.literal(FONTE_CLIMA),
      aviso: avisoSaida,
    }),
    z.object({ status: z.literal("cidade_nao_encontrada"), aviso: avisoSaida }),
    z.object({ status: z.literal("indisponivel"), aviso: avisoSaida }),
  ])
}

const climaAgoraSaida = saidaDeClima(climaAgoraTool.output)
const climaProximasHorasSaida = saidaDeClima(climaProximasHorasTool.output)

// Primeira cidade achada; busca fora do ar vira "indisponivel", nunca lança.
async function acharCidade(
  nome: string,
  deps: DepsPublicas,
): Promise<Cidade | "indisponivel" | undefined> {
  try {
    const [primeira] = await deps.cidades.buscar(nome)
    return primeira
  } catch (erro) {
    if (erro instanceof CityLookupUnavailableError) return "indisponivel"
    throw erro
  }
}

type ToolDeClima = {
  execute(entrada: object, ctx: ToolContext): Promise<{ status: string }>
}

// Fluxo comum às duas tools de clima: acha a cidade, roda a tool interna e junta região, país e fonte.
async function climaDaCidade(nome: string, deps: DepsPublicas, tool: ToolDeClima) {
  const achada = await acharCidade(nome, deps)
  if (achada === "indisponivel") return { status: "indisponivel", aviso: AVISO }
  if (!achada) return { status: "cidade_nao_encontrada", aviso: AVISO }
  const r = await tool.execute({}, contextoPublico(deps, { cidade: achada }))
  if (r.status !== "ok") return { status: "indisponivel", aviso: AVISO }
  return {
    ...r,
    ...(achada.regiao ? { regiao: achada.regiao } : {}),
    pais: achada.pais,
    fonte: FONTE_CLIMA,
    aviso: AVISO,
  }
}

const climaAgora = definirPublica({
  nome: "clima_agora",
  descricao: "Temperatura aparente e umidade de uma cidade, já em faixas e qualidades (gunas).",
  curta: "Clima agora em qualidades",
  entrada: cidadeEntrada,
  saida: climaAgoraSaida,
  logica: (e, deps) => climaDaCidade(e.cidade, deps, climaAgoraTool),
})

const climaProximasHoras = definirPublica({
  nome: "clima_proximas_horas",
  descricao: "Tendência das próximas 6 horas numa cidade: esquenta, esfria, estável e se chove.",
  curta: "Tendência das próximas horas",
  entrada: cidadeEntrada,
  saida: climaProximasHorasSaida,
  logica: (e, deps) => climaDaCidade(e.cidade, deps, climaProximasHorasTool),
})

export const TOOLS_PUBLICAS: ToolPublica<unknown, unknown>[] = [
  ayurvedaAlimento,
  ayurvedaCandidatos,
  ayurvedaSubstitutos,
  ayurvedaChecarCombinacao,
  climaAgora,
  climaProximasHoras,
]

export const DESCRICOES_PUBLICAS: { nome: string; curta: string }[] = TOOLS_PUBLICAS.map((t) => ({
  nome: t.nome,
  curta: t.curta,
}))
