import { config } from "@config/index"
import { z } from "zod"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { createPatterns } from "@/core/patterns"
import type { ItemTipo } from "@/core/preferences/ports"
import type { createRoutine } from "@/core/routine"
import { diaLocal, diasEntre } from "@/core/time/dia-local"
import type { Deps } from "./deps"
import { tocarGosto } from "./gosto"

export const acaoDaMemoriaSchema = z.discriminatedUnion("acao", [
  z.strictObject({
    acao: z.literal("gosto"),
    item_tipo: z.enum(["alimento", "pratica", "preparo"]),
    item_id: z.string().max(60),
    gosto: z.enum(["gosta", "nao_gosta"]).nullable(),
  }),
  z.strictObject({
    acao: z.literal("esquecer"),
    item_tipo: z.enum(["alimento", "pratica", "preparo"]),
    item_id: z.string().max(60),
  }),
  z.strictObject({ acao: z.literal("falta_apagar"), alimento_id: z.string().max(60) }),
  z.strictObject({
    acao: z.literal("nota_corrigir"),
    nota_id: z.uuid(),
    texto: z.string().max(400),
  }),
  z.strictObject({ acao: z.literal("nota_apagar"), nota_id: z.uuid() }),
  z.strictObject({
    acao: z.literal("padrao_decidir"),
    padrao_id: z.uuid(),
    decisao: z.enum(["confirmado", "recusado"]),
  }),
  z.strictObject({ acao: z.literal("padrao_apagar"), padrao_id: z.uuid() }),
  z.strictObject({ acao: z.literal("conversa_apagar"), dia: z.iso.date() }),
])

export type AcaoDaMemoria = z.infer<typeof acaoDaMemoriaSchema>

// Os métodos que a memória usa dos containers de rotina e de padrões (criados em `src/core/routine`
// e `src/core/patterns`). O composition root passa as instâncias reais.
type RotinaDeMemoria = Pick<ReturnType<typeof createRoutine>, "apagarNota" | "corrigirNota">
type PadroesDeMemoria = Pick<ReturnType<typeof createPatterns>, "decidirPadrao" | "apagarPadrao">

export type DepsDaMemoria = Deps & { routine: RotinaDeMemoria; patterns: PadroesDeMemoria }

type Nivel = "gostos" | "faltas" | "rotina" | "padroes" | "conversa"
type Feito = { nome: string; nivel: Nivel }
type Item = { tipo: ItemTipo; id: string }

const toqueInvalido = () => new RituError("toque_invalido", "Toque inválido")
const conversaEmAndamento = () => new RituError("conversa_em_andamento", "Conversa em andamento")

// Nome do item na base; undefined: fora da base.
function nomeDoItem(kb: KnowledgeBase, item: Item): string | undefined {
  switch (item.tipo) {
    case "alimento":
      return kb.alimento(item.id)?.nome
    case "preparo":
      return kb.preparo(item.id)?.nome
    case "pratica":
      return kb.pratica(item.id)?.nome
  }
}

// Só apaga a conversa de um dia dentro da janela (hoje e os dias anteriores, no fuso da conta).
async function apagarConversa(
  deps: DepsDaMemoria,
  contaId: string,
  dia: string,
  fuso: string,
): Promise<void> {
  const atras = diasEntre(dia, diaLocal(deps.clock.now(), fuso))
  if (atras < 0 || atras >= config.memoria.mensagensDias) throw toqueInvalido()
  await deps.tx.emTransacao(async (s) => {
    const aberto = await s.runs.aberto(contaId)
    if (aberto?.dia === dia) throw conversaEmAndamento()
    await s.messages.apagarDoDia(contaId, dia)
    await s.runs.tirarDaConversa(contaId, dia)
  })
}

async function executar(
  deps: DepsDaMemoria,
  contaId: string,
  acao: AcaoDaMemoria,
  fuso: string,
): Promise<Feito> {
  switch (acao.acao) {
    case "gosto": {
      const item = { tipo: acao.item_tipo, id: acao.item_id }
      await tocarGosto(deps, contaId, item, acao.gosto)
      return { nome: nomeDoItem(deps.kb, item) ?? item.id, nivel: "gostos" }
    }
    case "esquecer": {
      const item = { tipo: acao.item_tipo, id: acao.item_id }
      const nome = nomeDoItem(deps.kb, item)
      if (nome === undefined) throw toqueInvalido()
      await deps.tx.emTransacao((s) => s.preferences.apagar(contaId, item))
      return { nome, nivel: "gostos" }
    }
    case "falta_apagar": {
      const nome = deps.kb.alimento(acao.alimento_id)?.nome
      if (nome === undefined) throw toqueInvalido()
      await deps.tx.emTransacao((s) => s.shortages.apagarDoAlimento(contaId, acao.alimento_id))
      return { nome, nivel: "faltas" }
    }
    case "nota_corrigir":
      await deps.routine.corrigirNota(contaId, acao.nota_id, acao.texto)
      return { nome: "", nivel: "rotina" }
    case "nota_apagar":
      await deps.routine.apagarNota(contaId, acao.nota_id)
      return { nome: "", nivel: "rotina" }
    case "padrao_decidir":
      await deps.patterns.decidirPadrao(contaId, acao.padrao_id, acao.decisao)
      return { nome: "", nivel: "padroes" }
    case "padrao_apagar":
      await deps.patterns.apagarPadrao(contaId, acao.padrao_id)
      return { nome: "", nivel: "padroes" }
    case "conversa_apagar":
      await apagarConversa(deps, contaId, acao.dia, fuso)
      return { nome: "", nivel: "conversa" }
  }
}

export function tocarMemoria(
  deps: DepsDaMemoria,
  contaId: string,
  acao: AcaoDaMemoria,
  fuso: string,
): Promise<{ nome: string }> {
  return deps.telemetry.span("toque", { tipo: "memoria", acao: acao.acao }, async () => {
    const feito = await executar(deps, contaId, acao, fuso)
    deps.telemetry.contador("ritu_memoria_edicoes_total", {
      nivel: feito.nivel,
      acao: acao.acao,
    })
    return { nome: feito.nome }
  })
}
