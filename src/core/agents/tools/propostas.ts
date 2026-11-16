import { config } from "@config/index"
import { z } from "zod"
import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type ConteudoDaProposta, conteudoDaPropostaSchema } from "@/core/proposals/conteudo"
import { type ContextoDoRun, definirTool } from "@/core/tools/tool"

// Tools de proposta: validam o pedido pelo run e devolvem a proposta. Nunca gravam.

const CODIGOS_DE_RECUSA = [
  "com_incomodo",
  "sem_fato",
  "fato_com_incomodo",
  "ja_anotado",
  "fora_da_base",
  "sem_nao_tenho",
  "com_para_ter",
  "fora_do_candidato",
  "ja_na_lista",
  "ja_recusado",
  "filtrado",
  "rotina_cheia",
] as const

export type CodigoDeRecusaDeProposta = (typeof CODIGOS_DE_RECUSA)[number]

export type ResultadoDeProposta =
  | { proposto: true; proposta: ConteudoDaProposta }
  | { proposto: false; motivo: CodigoDeRecusaDeProposta }

type PedidoDeLista = { alimento_id: string; pratica_id?: string; preparo_id?: string }
type Candidato = ContextoDoRun["candidatos"][number]

// Sem ctx.run (nenhum preparo no contexto): nada indicado, nada na lista.
const RUN_VAZIO: ContextoDoRun = {
  com_incomodo: false,
  tem_para_ter: false,
  nao_tem: [],
  candidatos: [],
  na_lista: [],
  lista_recusada: [],
  notas_ativas: [],
}

const codigoSchema = z.enum(CODIGOS_DE_RECUSA)

const resultadoSchema: z.ZodType<ResultadoDeProposta> = z.union([
  z.object({ proposto: z.literal(true), proposta: conteudoDaPropostaSchema }),
  z.object({ proposto: z.literal(false), motivo: codigoSchema }),
])

const memoriaEntradaSchema = z.strictObject({ tipo: z.literal("rotina") })

const listaEntradaSchema = z.strictObject({
  alimento_id: z.string(),
  pratica_id: z.string().optional(),
  preparo_id: z.string().optional(),
})

function recusa(motivo: CodigoDeRecusaDeProposta): ResultadoDeProposta {
  return { proposto: false, motivo }
}

function resumir(resultado: ResultadoDeProposta): string {
  return resultado.proposto ? "proposto" : `recusado: ${resultado.motivo}`
}

export function validarMemoriaPropor(
  run: ContextoDoRun,
  kb: KnowledgeBase,
): CodigoDeRecusaDeProposta | undefined {
  if (run.com_incomodo) return "com_incomodo"
  if (!run.fato_de_rotina) return "sem_fato"
  if (contemIncomodo(run.fato_de_rotina, kb)) return "fato_com_incomodo"
  const fato = normalizar(run.fato_de_rotina)
  if (run.notas_ativas.some((nota) => normalizar(nota) === fato)) return "ja_anotado"
  if (run.notas_ativas.length >= config.memoria.rotinaNotasAtivas) return "rotina_cheia"
  return undefined
}

// Pratica (não refeição) ou preparo (refeição), só quando exatamente um dos dois vem.
function candidatoIndicado(pedido: PedidoDeLista, run: ContextoDoRun): Candidato | undefined {
  if (pedido.pratica_id !== undefined && pedido.preparo_id === undefined) {
    const id = pedido.pratica_id
    return run.candidatos.find((c) => c.tipo !== "refeicao" && c.id === id)
  }
  if (pedido.preparo_id !== undefined && pedido.pratica_id === undefined) {
    const id = pedido.preparo_id
    return run.candidatos.find((c) => c.tipo === "refeicao" && c.id === id)
  }
  return undefined
}

export function validarListaPropor(
  pedido: PedidoDeLista,
  run: ContextoDoRun,
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): CodigoDeRecusaDeProposta | undefined {
  const id = pedido.alimento_id
  if (run.com_incomodo) return "com_incomodo"
  const alimento = kb.alimento(id)
  if (!alimento) return "fora_da_base"
  if (!run.nao_tem.includes(id)) return "sem_nao_tenho"
  if (run.tem_para_ter) return "com_para_ter"
  const candidato = candidatoIndicado(pedido, run)
  if (!candidato?.alimentos.includes(id)) return "fora_do_candidato"
  if (run.na_lista.includes(id)) return "ja_na_lista"
  if (run.lista_recusada.includes(id)) return "ja_recusado"
  if (!passaNoFiltro(alimento, filtro, kb).passa) return "filtrado"
  return undefined
}

export const memoriaPropor = definirTool({
  name: "memoria.propor",
  description:
    "Propõe guardar o fato_de_rotina do contexto como nota de rotina. Só grava se a pessoa aprovar.",
  input: memoriaEntradaSchema,
  output: resultadoSchema,
  resumir,
  executar(_entrada, ctx) {
    const run = ctx.run ?? RUN_VAZIO
    const motivo = validarMemoriaPropor(run, ctx.kb)
    if (motivo !== undefined) return recusa(motivo)
    return {
      proposto: true,
      proposta: { tool: "memoria.propor", tipo: "rotina", texto: run.fato_de_rotina ?? "" },
    }
  },
})

export const listaPropor = definirTool({
  name: "lista.propor",
  description:
    "Propõe pôr na lista Para ter em casa um alimento que a pessoa respondeu que não tem e que faltou para uma sugestão. Só grava se a pessoa aprovar.",
  input: listaEntradaSchema,
  output: resultadoSchema,
  resumir,
  executar(entrada, ctx) {
    const run = ctx.run ?? RUN_VAZIO
    const motivo = validarListaPropor(entrada, run, ctx.filtro, ctx.kb)
    const candidato = candidatoIndicado(entrada, run)
    if (motivo !== undefined || candidato === undefined) {
      return recusa(motivo ?? "fora_do_candidato")
    }
    return {
      proposto: true,
      proposta: {
        tool: "lista.propor",
        alimento_id: entrada.alimento_id,
        motivo: "faltou_hoje",
        detalhe: candidato.nome,
      },
    }
  },
})
