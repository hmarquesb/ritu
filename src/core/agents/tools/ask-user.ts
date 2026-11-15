import { config } from "@config/index"
import { z } from "zod"
import { type DadosDoPreparo, dadosDoPreparoSchema } from "@/core/agents/companion/preparo"
import { passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Preferencia } from "@/core/preferences/ports"
import type { ToolDeControle } from "@/core/runs/agente"
import {
  montarPergunta,
  type Pergunta,
  perguntaSchema,
  type RespostaDeCasa,
  respostaDaPessoaSchema,
} from "@/core/runs/pergunta"

export type CodigoDeRecusa =
  | "limite_de_perguntas"
  | "muitos_itens"
  | "fora_da_base"
  | "ja_confirmado"
  | "filtrado"
  | "acabou"
  | "fora_dos_candidatos"
  | "ja_perguntado"
  | "come_desnecessaria"

export type PedidoDePergunta =
  | { tipo: "casa"; alimentos: string[] }
  | { tipo: "come"; alimento: string }

const pedidoSchema: z.ZodType<PedidoDePergunta> = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("casa"), alimentos: z.array(z.string()) }),
  z.object({ tipo: z.literal("come"), alimento: z.string() }),
])

const retomadaSchema = z.object({
  pergunta: perguntaSchema,
  resposta: respostaDaPessoaSchema,
  candidatos_retirados: z.array(z.string()),
})

type Conferencia = {
  dados: DadosDoPreparo
  acabou: string[]
  preferencias: Preferencia[]
  kb: KnowledgeBase
}
type Recusa = { codigo: CodigoDeRecusa; alimentos?: string[] }

function idsDoPedido(pedido: PedidoDePergunta): string[] {
  return pedido.tipo === "casa" ? pedido.alimentos : [pedido.alimento]
}

function idsDosCandidatos(dados: DadosDoPreparo): Set<string> {
  const ids = new Set<string>()
  for (const c of dados.candidatos) {
    for (const i of c.itens) ids.add(i.alimento_id)
    for (const lista of Object.values(c.opcoes ?? {})) {
      for (const i of lista ?? []) ids.add(i.alimento_id)
    }
  }
  return ids
}

function dispensaAPergunta(id: string, p: Conferencia): boolean {
  if (p.dados.casa.confirmados.includes(id) || p.dados.casa.incertos.includes(id)) return true
  const pref = p.preferencias.find((x) => x.item_tipo === "alimento" && x.item_id === id)
  return pref !== undefined && (pref.gosto === "gosta" || pref.ajudou > 0)
}

function recusarSe(ids: string[], ruim: (id: string) => boolean, codigo: CodigoDeRecusa) {
  const alimentos = ids.filter(ruim)
  return alimentos.length > 0 ? { codigo, alimentos } : undefined
}

function barradoPeloFiltro(id: string, p: Conferencia): boolean {
  const alimento = p.kb.alimento(id)
  return alimento !== undefined && !passaNoFiltro(alimento, p.dados.filtro, p.kb).passa
}

export function validarPedidoDePergunta(
  pedido: PedidoDePergunta,
  p: Conferencia,
): Recusa | undefined {
  const ids = idsDoPedido(pedido)
  if (p.dados.perguntas.feitas >= config.pausas.maxPerguntasPorRun) {
    return { codigo: "limite_de_perguntas" }
  }
  if (ids.length === 0 || ids.length > config.pausas.maxItensPorPergunta) {
    return { codigo: "muitos_itens" }
  }
  const candidatos = idsDosCandidatos(p.dados)
  return (
    recusarSe(ids, (id) => !p.kb.alimento(id), "fora_da_base") ??
    recusarSe(ids, (id) => p.dados.casa.confirmados.includes(id), "ja_confirmado") ??
    recusarSe(ids, (id) => barradoPeloFiltro(id, p), "filtrado") ??
    recusarSe(ids, (id) => p.acabou.includes(id), "acabou") ??
    recusarSe(ids, (id) => !candidatos.has(id), "fora_dos_candidatos") ??
    recusarSe(ids, (id) => p.dados.perguntas.alimentos.includes(id), "ja_perguntado") ??
    (pedido.tipo === "come"
      ? recusarSe(ids, (id) => dispensaAPergunta(id, p), "come_desnecessaria")
      : undefined)
  )
}

function resumoDoPedido(pedido: PedidoDePergunta): string {
  if (pedido.tipo === "come") return "come"
  const n = pedido.alimentos.length
  return `casa: ${n} ${n === 1 ? "item" : "itens"}`
}

function resultadoDaRetomada(
  pergunta: Pergunta,
  resposta: z.infer<typeof respostaDaPessoaSchema>,
  candidatosRetirados: string[],
): unknown {
  if (pergunta.tipo === "casa") {
    const dadas = new Map<string, RespostaDeCasa>()
    if (resposta.tipo === "casa")
      for (const i of resposta.itens) dadas.set(i.alimento_id, i.resposta)
    return {
      respostas: pergunta.itens.map((i) => ({
        alimento_id: i.alimento_id,
        nome: i.nome,
        resposta: dadas.get(i.alimento_id) ?? "pulou",
      })),
      candidatos_retirados: candidatosRetirados,
    }
  }
  if (pergunta.tipo === "come") {
    return {
      alimento_id: pergunta.alimento_id,
      nome: pergunta.nome,
      resposta: resposta.tipo === "come" ? resposta.resposta : "pulou",
    }
  }
  return { erro: "resposta_invalida" }
}

export const askUser: ToolDeControle<PedidoDePergunta> = {
  name: "ask_user",
  description:
    "Pergunta à pessoa se ela tem um alimento em casa (tipo casa, até 5 de uma vez) ou se come um alimento (tipo come). Use só quando a resposta muda o que você vai sugerir.",
  input: pedidoSchema,
  async tratar(pedido, ctx, estado) {
    const dados = dadosDoPreparoSchema.parse(estado.dados)
    const itens = await ctx.stores.pantry.listar(ctx.contaId)
    const acabou = [
      ...new Set([
        ...dados.acabou,
        ...itens
          .filter((i) => i.estado === "acabou" && i.alimento_id)
          .map((i) => i.alimento_id as string),
      ]),
    ]
    const preferencias = await ctx.stores.preferences.ler(ctx.contaId)
    const recusa = validarPedidoDePergunta(pedido, { dados, acabou, preferencias, kb: ctx.kb })
    if (recusa) {
      return {
        tipo: "recusar",
        resultado: {
          perguntou: false,
          motivo: recusa.codigo,
          ...(recusa.alimentos ? { alimentos: recusa.alimentos } : {}),
        },
      }
    }
    const ids = idsDoPedido(pedido)
    const pergunta = montarPergunta(
      pedido.tipo === "casa"
        ? {
            tipo: "casa",
            alimentos: pedido.alimentos,
            incertos: pedido.alimentos.filter((id) => dados.casa.incertos.includes(id)),
          }
        : { tipo: "come", alimento: pedido.alimento },
      ctx.kb,
    )
    estado.dados = {
      ...dados,
      perguntas: {
        feitas: dados.perguntas.feitas + 1,
        alimentos: [...dados.perguntas.alimentos, ...ids],
      },
    }
    return {
      tipo: "pausar",
      pendencia: { tipo: "pergunta", conteudo: { origem: "agente", pergunta } },
      resumo: resumoDoPedido(pedido),
    }
  },
  aoRetomar(retomada) {
    const lida = retomadaSchema.safeParse(retomada)
    if (!lida.success) return { erro: "resposta_invalida" }
    const { pergunta, resposta, candidatos_retirados } = lida.data
    return resultadoDaRetomada(pergunta, resposta, candidatos_retirados)
  },
}
