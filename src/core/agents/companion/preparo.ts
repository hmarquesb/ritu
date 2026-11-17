import { config } from "@config/index"
import { z } from "zod"
import type { ItemTemporario } from "@/core/accounts/ports"
import type { Clock } from "@/core/clock"
import { itemDoNaoCome, montarFiltro } from "@/core/filtro-da-pessoa"
import type { Prakriti } from "@/core/knowledge/adequacao"
import { type EvitarItem, type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import { resolverEvitar } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import {
  type MomentoQualidades,
  momentoDoDia as momentoDoDiaDaHora,
  qualidadesDoMomento,
} from "@/core/knowledge/momento"
import type { Preparo } from "@/core/knowledge/schemas"
import {
  estadoSchema,
  funcaoSchema,
  gunaSchema,
  marcaSchema,
  momentoDoDiaSchema,
  restricaoSchema,
} from "@/core/knowledge/vocab"
import { lerConversaDoDia } from "@/core/messages/para-o-prompt"
import { estadoDoItem } from "@/core/pantry/estado"
import { padraoVale } from "@/core/patterns/vale"
import type { Preferencia } from "@/core/preferences/ports"
import { cortarParaOContexto, montarCandidatos } from "@/core/ranking/candidatos"
import { escolherParaTer, faltasDoRun } from "@/core/ranking/faltas"
import type { Candidato, ParaTer, Sinais } from "@/core/ranking/tipos"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { diaLocal, diasAtras, diasEntre } from "@/core/time/dia-local"
import { horaLocal } from "@/core/weather/hora-local"
import {
  casaDaMensagemSchema,
  type EntradaDoAcompanhante,
  intencaoSchema,
  retornoDaMensagemSchema,
} from "./entrada"

export type {
  Candidato,
  EstadoNaCasa,
  ItemDoCandidato,
  ParaTer,
  Sinais,
} from "@/core/ranking/tipos"

const itemDoCandidatoSchema = z.object({
  alimento_id: z.string(),
  nome: z.string(),
  funcao: funcaoSchema.optional(),
  casa: z.enum(["confirmado", "incerto", "ausente"]),
  contribui: z.array(gunaSchema),
  linha_base: z.string(),
})

const candidatoSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  id: z.string(),
  nome: z.string(),
  itens: z.array(itemDoCandidatoSchema),
  opcoes: z.partialRecord(funcaoSchema, z.array(itemDoCandidatoSchema)).optional(),
  contribui: z.array(gunaSchema),
  linha_base: z.string(),
  adequacao: z.number(),
  nota: z.number(),
  gosta: z.boolean(),
  ajudou: z.number(),
  novidade: z.boolean(),
  no_fim: z.boolean(),
  depende_de_pergunta: z.boolean().optional(),
})

const evitarItemSchema = z.object({
  tipo: z.enum(["grupo", "alimento", "texto"]),
  valor: z.string(),
})

const qualidadesSchema = z.object({
  presentes: z.array(gunaSchema),
  buscadas: z.array(gunaSchema),
  evitar_gunas: z.array(gunaSchema),
  evitar_marcas: z.array(marcaSchema),
  evitar: z.array(z.object({ texto: z.string(), linha_base: z.string() })),
  conflitos: z.array(z.tuple([gunaSchema, gunaSchema])),
  linhas_base: z.array(z.string()),
  precisa_variante: z
    .object({
      incomodo: z.string(),
      pergunta: z.string(),
      opcoes: z.array(z.object({ id: z.string(), texto: z.string() })),
    })
    .optional(),
})

const sinaisSchema = z.object({
  mensagens_hoje: z.number(),
  itens_confirmados_em_casa: z.number(),
  itens_incertos_em_casa: z.number(),
  registros_de_gosto: z.number(),
  registros_de_resultado: z.number(),
  retornos_pendentes: z.number(),
  tem_cidade: z.boolean(),
})

const paraTerSchema = z.object({
  alimento_id: z.string(),
  nome: z.string(),
  vezes: z.number(),
  contribui: z.array(gunaSchema),
  linha_base: z.string(),
})

export const dadosDoPreparoSchema = z.object({
  versao: z.literal(1),
  intencoes: z.array(intencaoSchema),
  estados: z.array(estadoSchema),
  incomodo: z.object({ id: z.string(), variante: z.string().optional() }).optional(),
  com_incomodo: z.boolean(),
  dia: z.string(),
  momento_do_dia: momentoDoDiaSchema,
  geral: z.boolean(),
  qualidades: qualidadesSchema,
  filtro: z.object({
    evitar: z.array(evitarItemSchema),
    restricoes: z.array(restricaoSchema),
    nao_come: z.array(z.string()),
    nao_gosta: z.array(z.string()),
  }),
  evitar_textos: z.array(z.string()),
  casa: z.object({ confirmados: z.array(z.string()), incertos: z.array(z.string()) }),
  candidatos: z.array(candidatoSchema),
  para_ter: paraTerSchema.optional(),
  faltas_do_run: z.array(z.string()),
  sugeridos_hoje: z.array(z.string()),
  sinais: sinaisSchema,
  fixos: z.object({
    dosha: z.string().optional(),
    cidade: z.string().optional(),
    evitar_sempre: z.array(z.string()),
    restricoes: z.array(restricaoSchema),
    nao_come: z.array(z.string()),
  }),
  resumo_de_rotina: z.string().optional(),
  padroes: z.array(z.string()),
  mensagens_do_dia: z.array(z.object({ autor: z.enum(["pessoa", "agente"]), texto: z.string() })),
  casa_da_mensagem: casaDaMensagemSchema.optional(),
  gosta_da_mensagem: z.array(z.string()).optional(),
  retorno: retornoDaMensagemSchema.optional(),
  retornos_pendentes: z
    .array(
      z.object({
        n: z.number().int(),
        retorno_id: z.string(),
        tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
        titulo: z.string(),
        ha_dias: z.number().int(),
      }),
    )
    .default([]),
  fato_de_rotina: z.string().optional(),
  perguntas: z
    .object({ feitas: z.number().int().nonnegative(), alimentos: z.array(z.string()) })
    .default({ feitas: 0, alimentos: [] }),
  nao_come_do_run: z.array(z.string()).default([]),
  candidatos_completos: z.array(z.string()).default([]),
  acabou: z.array(z.string()).default([]),
  nao_tem_do_run: z.array(z.string()).default([]),
  candidatos_do_preparo: z
    .array(
      z.object({
        tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
        id: z.string(),
        nome: z.string(),
        alimentos: z.array(z.string()),
      }),
    )
    .default([]),
  na_lista: z.array(z.string()).default([]),
  lista_recusada: z.array(z.string()).default([]),
  notas_ativas: z.array(z.string()).default([]),
})

export type DadosDoPreparo = z.infer<typeof dadosDoPreparoSchema>

type Deps = { stores: Stores; kb: KnowledgeBase; clock: Clock; telemetry: Telemetry }
type Casa = DadosDoPreparo["casa"]

const HORAS_DE_FOLGA = 36
const LIMITE_DE_RUNS = 50

function naoComeERestricaoDaMensagem(entrada: EntradaDoAcompanhante): ItemTemporario[] {
  const naoCome = (entrada.nao_come_da_mensagem ?? []).map(itemDoNaoCome)
  const restricoes = (entrada.restricoes_da_mensagem ?? []).map((valor) => ({
    tipo: "restricao" as const,
    valor,
  }))
  return [...naoCome, ...restricoes]
}

// O gosto citado na mensagem vale neste run: uma cópia das preferências, sem gravar nada.
function comGostoDaMensagem(
  preferencias: Preferencia[],
  contaId: string,
  entrada: EntradaDoAcompanhante,
  kb: KnowledgeBase,
): Preferencia[] {
  const ids = (entrada.gosta_da_mensagem ?? []).filter((id) => kb.alimento(id))
  if (ids.length === 0) return preferencias
  const citados = new Set(ids)
  const jaTem = new Set(
    preferencias.filter((p) => p.item_tipo === "alimento").map((p) => p.item_id),
  )
  const zeradas: Preferencia[] = [...citados]
    .filter((id) => !jaTem.has(id))
    .map((id) => ({
      conta_id: contaId,
      item_tipo: "alimento",
      item_id: id,
      gosto: "gosta",
      ajudou: 0,
      nao_ajudou: 0,
      nao_fez: 0,
      ultimos_resultados: [],
      ultima_sugestao_em: null,
    }))
  const marcadas = preferencias.map((p) =>
    p.item_tipo === "alimento" && citados.has(p.item_id) ? { ...p, gosto: "gosta" as const } : p,
  )
  return [...marcadas, ...zeradas]
}

async function gravarDaMensagem(
  deps: Deps,
  contaId: string,
  dia: string,
  entrada: EntradaDoAcompanhante,
): Promise<{ evitar: EvitarItem[]; doDia: ItemTemporario[] }> {
  const evitar = entrada.evitar_da_mensagem.map((texto) => resolverEvitar(texto, deps.kb))
  const doDia = naoComeERestricaoDaMensagem(entrada)
  const itens: ItemTemporario[] = [...evitar, ...doDia]
  if (itens.length > 0) await deps.stores.profiles.acrescentarEvitarTemporario(contaId, dia, itens)
  return { evitar, doDia }
}

// `tem` entra em confirmados (se passar no filtro) e sai de incertos; `acabou` sai das duas.
function ajustarCasa(
  casa: Casa,
  entrada: EntradaDoAcompanhante,
  deps: Deps,
  filtro: FiltroPessoa,
): Casa {
  const msg = entrada.casa_da_mensagem
  if (!msg) return casa
  const acabou = new Set(msg.acabou)
  const tem = msg.tem.filter((id) => {
    const alimento = deps.kb.alimento(id)
    return !acabou.has(id) && !!alimento && passaNoFiltro(alimento, filtro, deps.kb).passa
  })
  const entram = new Set(tem)
  const fora = new Set([...acabou, ...entram])
  return {
    confirmados: [...new Set([...casa.confirmados.filter((id) => !acabou.has(id)), ...tem])],
    incertos: casa.incertos.filter((id) => !fora.has(id)),
  }
}

// Minha casa vira a casa do run e a lista dos ids marcados como acabou (que não seguram refeição).
export async function casaEAcabou(
  deps: Deps,
  contaId: string,
  filtro: FiltroPessoa,
): Promise<{ casa: Casa; acabou: string[] }> {
  const itens = await deps.stores.pantry.listar(contaId)
  const agora = deps.clock.now()
  const casa: Casa = { confirmados: [], incertos: [] }
  const acabou: string[] = []
  for (const item of itens) {
    if (item.estado === "acabou" && item.alimento_id) acabou.push(item.alimento_id)
    const alimento = item.alimento_id ? deps.kb.alimento(item.alimento_id) : undefined
    if (!alimento || !passaNoFiltro(alimento, filtro, deps.kb).passa) continue
    const estado = estadoDoItem(item, agora, alimento.durabilidade)
    if (estado === "incerto") casa.incertos.push(alimento.id)
    else if (estado !== "acabou") casa.confirmados.push(alimento.id)
  }
  return { casa, acabou }
}

function sugeridosDasSaidas(saidas: unknown[]): string[] {
  const ids = saidas.flatMap((saida) => {
    const sugestoes = (saida as { sugestoes?: unknown } | null)?.sugestoes
    if (!Array.isArray(sugestoes)) return []
    return sugestoes.flatMap((s: { pratica_id?: string; preparo_id?: string }) => {
      if (s?.pratica_id) return [`praticas:${s.pratica_id}`]
      if (s?.preparo_id) return [`preparos:${s.preparo_id}`]
      return []
    })
  })
  return [...new Set(ids)]
}

async function sugeridosDeHoje(deps: Deps, contaId: string, dia: string): Promise<string[]> {
  const desde = new Date(deps.clock.now().getTime() - HORAS_DE_FOLGA * 3_600_000)
  const runs = await deps.stores.runs.recentes(contaId, desde, LIMITE_DE_RUNS)
  return sugeridosDasSaidas(runs.filter((r) => r.dia === dia).map((r) => r.saida))
}

function doshaDominante(prakriti: Prakriti | null): string | undefined {
  if (!prakriti) return undefined
  const pares = Object.entries(prakriti).filter(([, v]) => v !== undefined)
  const maximo = Math.max(...pares.map(([, v]) => v ?? 0))
  const dominantes = pares.filter(([, v]) => v === maximo).map(([k]) => k)
  return dominantes.length > 0 ? dominantes.join(" e ") : undefined
}

function nomeDoItem(item: { tipo: string; valor: string }, kb: KnowledgeBase): string {
  if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome ?? item.valor
  if (item.tipo === "grupo")
    return kb.gruposEvitar.find((g) => g.id === item.valor)?.nome ?? item.valor
  return item.valor
}

type Contexto = {
  deps: Deps
  contaId: string
  entrada: EntradaDoAcompanhante
  runId?: string
  dia: string
  filtro: FiltroPessoa
  prakriti?: Prakriti
  casa: Casa
  preferencias: Preferencia[]
  sugeridos_hoje: string[]
  qualidades: MomentoQualidades
  momento_do_dia: DadosDoPreparo["momento_do_dia"]
  acabou: string[]
}

type Situacao = "fora" | "em_casa" | "pergunta"

function semPergunta(c: Candidato): Candidato {
  const { depende_de_pergunta: _dependia, ...resto } = c
  return resto
}

// "fora": alguma vaga obrigatória não tem opção em casa nem perguntável.
// "pergunta": alguma vaga obrigatória só tem opção perguntável. "em_casa": o resto.
function situacaoDaRefeicao(
  c: Candidato,
  preparo: Preparo,
  emCasa: Set<string>,
  perguntavel: (id: string) => boolean,
): Situacao {
  let dependeDePergunta = false
  for (const vaga of preparo.vagas) {
    if (!vaga.obrigatoria) continue
    const ids = (c.opcoes?.[vaga.funcao] ?? []).map((item) => item.alimento_id)
    if (ids.some((id) => emCasa.has(id))) continue
    if (!ids.some(perguntavel)) return "fora"
    dependeDePergunta = true
  }
  return dependeDePergunta ? "pergunta" : "em_casa"
}

// Candidato de refeição sem opção de vaga obrigatória em casa nem perguntável não vai ao modelo
// nem ao validador. Refeição que só fica por causa de uma opção perguntável sai com
// depende_de_pergunta, e só as primeiras maxRefeicoesAPerguntar delas. Chá, óleo e prática passam.
export function entregaveis(
  candidatos: Candidato[],
  p: { casa: Casa; acabou: string[]; perguntasRestantes: number },
  kb: KnowledgeBase,
): Candidato[] {
  const emCasa = new Set([...p.casa.confirmados, ...p.casa.incertos])
  const perguntavel = (id: string) =>
    p.perguntasRestantes > 0 && !emCasa.has(id) && !p.acabou.includes(id)
  let marcadas = 0
  const saida: Candidato[] = []
  for (const candidato of candidatos) {
    if (candidato.tipo !== "refeicao") {
      saida.push(candidato)
      continue
    }
    const preparo = kb.preparo(candidato.id)
    const situacao = preparo
      ? situacaoDaRefeicao(candidato, preparo, emCasa, perguntavel)
      : "em_casa"
    if (situacao === "fora") continue
    if (situacao === "em_casa") {
      saida.push(semPergunta(candidato))
    } else if (marcadas < config.pausas.maxRefeicoesAPerguntar) {
      marcadas++
      saida.push({ ...semPergunta(candidato), depende_de_pergunta: true })
    }
  }
  return saida
}

function candidatosEFaltas(c: Contexto): { todos: Candidato[]; faltas: string[] } {
  const { entrada, deps } = c
  const querCandidatos =
    entrada.intencoes.includes("momento") || entrada.estados.length > 0 || !!entrada.incomodo
  if (!querCandidatos) return { todos: [], faltas: [] }
  const todos = montarCandidatos(
    {
      qualidades: c.qualidades,
      estados: entrada.estados,
      momento_do_dia: c.momento_do_dia,
      filtro: c.filtro,
      prakriti: c.prakriti,
      restricoes: c.filtro.restricoes,
      casa: c.casa,
      preferencias: c.preferencias,
      sugeridos_hoje: c.sugeridos_hoje,
    },
    deps.kb,
  )
  const faltas = faltasDoRun(
    { candidatos: todos, casa: c.casa, prakriti: c.prakriti, buscadas: c.qualidades.buscadas },
    deps.kb,
  )
  return { todos, faltas }
}

type Listas = Pick<DadosDoPreparo, "na_lista" | "lista_recusada" | "notas_ativas">

// Lidas uma vez por preparo: alimentam o para_ter e o ctx.run das tools de proposta.
async function listasDoRun(stores: Stores, contaId: string): Promise<Listas> {
  const [lista, recusadas, notas] = await Promise.all([
    stores.shortages.lista(contaId),
    stores.proposals.recusadas(contaId, "lista.propor"),
    stores.routine.notasAtivas(contaId),
  ])
  return {
    na_lista: lista.map((i) => i.alimento_id),
    lista_recusada: recusadas.flatMap((p) => {
      const id = (p.conteudo as { alimento_id?: unknown } | null)?.alimento_id
      return typeof id === "string" ? [id] : []
    }),
    notas_ativas: notas.map((n) => n.texto),
  }
}

async function paraTerDoRun(
  c: Contexto,
  faltas: string[],
  listas: Listas,
): Promise<ParaTer | undefined> {
  if (!c.entrada.intencoes.includes("momento") || c.entrada.incomodo) return undefined
  const diasComFalta = await c.deps.stores.shortages.diasComFalta(
    c.contaId,
    diasAtras(c.dia, config.ranking.faltas.janelaDias - 1),
  )
  return escolherParaTer(
    {
      diasComFalta,
      faltasDeHoje: faltas,
      hoje: c.dia,
      filtro: c.filtro,
      naLista: listas.na_lista,
      recusados: listas.lista_recusada,
      buscadas: c.qualidades.buscadas,
    },
    c.deps.kb,
  )
}

// Os alimentos de itens e de todas as opções, sem repetir: o que a tool de proposta confere.
function doPreparo(c: Candidato): DadosDoPreparo["candidatos_do_preparo"][number] {
  const opcoes = Object.values(c.opcoes ?? {}).flatMap((lista) => lista ?? [])
  const ids = [...c.itens, ...opcoes].map((item) => item.alimento_id)
  return { tipo: c.tipo, id: c.id, nome: c.nome, alimentos: [...new Set(ids)] }
}

async function lerContexto(
  deps: Deps,
  contaId: string,
  entrada: EntradaDoAcompanhante,
): Promise<{
  c: Contexto
  evitar_textos: string[]
  fuso?: string
  perfil: Awaited<ReturnType<Stores["profiles"]["ler"]>>
}> {
  const { stores, kb, clock } = deps
  const perfil = await stores.profiles.ler(contaId)
  const fuso = perfil.cidade_fuso ?? undefined
  const agora = clock.now()
  const dia = diaLocal(agora, fuso)
  const [evitarDoDia, lidas] = await Promise.all([
    stores.profiles.evitarTemporario(contaId, dia),
    stores.preferences.ler(contaId),
  ])
  const preferencias = comGostoDaMensagem(lidas, contaId, entrada, kb)
  const daMensagem = await gravarDaMensagem(deps, contaId, dia, entrada)
  const { filtro, evitar_textos } = montarFiltro({
    perfil,
    evitarDoDia: [...evitarDoDia, ...daMensagem.doDia],
    evitarDaMensagem: daMensagem.evitar,
    preferencias,
  })
  const hora = horaLocal(agora, fuso ?? config.clima.fusoPadrao)
  const qualidades = qualidadesDoMomento(
    { estados: entrada.estados, incomodo: entrada.incomodo },
    kb,
  )
  const { casa, acabou } = await casaEAcabou(deps, contaId, filtro)
  const c: Contexto = {
    deps,
    contaId,
    entrada,
    dia,
    filtro,
    prakriti: perfil.prakriti ?? undefined,
    casa: ajustarCasa(casa, entrada, deps, filtro),
    acabou: [...new Set([...acabou, ...(entrada.casa_da_mensagem?.acabou ?? [])])],
    preferencias,
    sugeridos_hoje: await sugeridosDeHoje(deps, contaId, dia),
    qualidades,
    momento_do_dia: momentoDoDiaDaHora(hora),
  }
  return { c, evitar_textos, fuso, perfil }
}

export function preparar(
  deps: Deps,
  contaId: string,
  entrada: EntradaDoAcompanhante,
  opts?: { runId?: string; perguntasFeitas?: number },
): Promise<DadosDoPreparo> {
  return deps.telemetry.span("preparo", {}, async (span) => {
    const { c, evitar_textos, perfil } = await lerContexto(deps, contaId, entrada)
    c.runId = opts?.runId ?? ""
    const feitas = opts?.perguntasFeitas ?? 0
    const { todos, faltas } = candidatosEFaltas(c)
    const candidatos = cortarParaOContexto(
      entregaveis(
        todos,
        {
          casa: c.casa,
          acabou: c.acabou,
          perguntasRestantes: config.pausas.maxPerguntasPorRun - feitas,
        },
        deps.kb,
      ),
    )
    const listas = await listasDoRun(deps.stores, contaId)
    const para_ter = await paraTerDoRun(c, faltas, listas)
    const dados = await completar(c, {
      evitar_textos,
      perfil,
      candidatos,
      faltas,
      para_ter,
      candidatos_completos: todos.map((t) => t.id),
      candidatos_do_preparo: todos.map(doPreparo),
      listas,
      perguntas: { feitas, alimentos: [] },
    })
    span.atribuir({
      "candidatos.total": candidatos.length,
      "faltas.registradas": faltas.length,
      "para_ter.candidato": para_ter !== undefined,
    })
    return dados
  })
}

type Montado = {
  evitar_textos: string[]
  perfil: Awaited<ReturnType<Stores["profiles"]["ler"]>>
  candidatos: Candidato[]
  faltas: string[]
  para_ter?: ParaTer
  candidatos_completos: string[]
  candidatos_do_preparo: DadosDoPreparo["candidatos_do_preparo"]
  listas: Listas
  perguntas: DadosDoPreparo["perguntas"]
}

async function completar(c: Contexto, m: Montado): Promise<DadosDoPreparo> {
  const { stores, kb } = c.deps
  const { perfil } = m
  const [contagem, pendentes, resumo, padroes, mensagens] = await Promise.all([
    stores.preferences.contagem(c.contaId),
    stores.outcomes.pendentes(c.contaId),
    stores.routine.resumo(c.contaId),
    stores.patterns.listar(c.contaId, "confirmado"),
    stores.messages.doDia(c.contaId, c.dia),
  ])
  const mensagensDoPrompt = await lerConversaDoDia(stores, {
    contaId: c.contaId,
    dia: c.dia,
    agora: c.deps.clock.now(),
    runAtualId: c.runId ?? "",
    limite: config.memoria.mensagensDoDiaNoPrompt,
  })
  const sinais: Sinais = {
    mensagens_hoje: mensagens.filter((x) => x.autor === "pessoa").length,
    itens_confirmados_em_casa: c.casa.confirmados.length,
    itens_incertos_em_casa: c.casa.incertos.length,
    registros_de_gosto: contagem.de_gosto,
    registros_de_resultado: contagem.de_resultado,
    retornos_pendentes: pendentes.length,
    tem_cidade: perfil.cidade_nome !== null,
  }
  const { entrada } = c
  return {
    versao: 1,
    intencoes: entrada.intencoes,
    estados: entrada.estados,
    ...(entrada.incomodo ? { incomodo: entrada.incomodo } : {}),
    com_incomodo: !!entrada.incomodo,
    dia: c.dia,
    momento_do_dia: c.momento_do_dia,
    geral: perfil.prakriti === null,
    qualidades: c.qualidades,
    filtro: c.filtro,
    evitar_textos: m.evitar_textos,
    casa: c.casa,
    candidatos: m.candidatos,
    ...(m.para_ter ? { para_ter: m.para_ter } : {}),
    faltas_do_run: m.faltas,
    sugeridos_hoje: c.sugeridos_hoje,
    sinais,
    fixos: {
      dosha: doshaDominante(perfil.prakriti),
      cidade: perfil.cidade_nome ?? undefined,
      evitar_sempre: perfil.evitar_sempre.map((i) => nomeDoItem(i, kb)),
      restricoes: perfil.restricoes,
      nao_come: perfil.nao_come.map((i) => nomeDoItem(i, kb)),
    },
    ...(resumo?.texto ? { resumo_de_rotina: resumo.texto } : {}),
    padroes: padroes
      .filter((p) => padraoVale(p, c.filtro, kb))
      .slice(0, config.memoria.padroesNoPrompt)
      .map((p) => p.frase),
    mensagens_do_dia: mensagensDoPrompt,
    perguntas: m.perguntas,
    nao_come_do_run: [],
    candidatos_completos: m.candidatos_completos,
    acabou: c.acabou,
    nao_tem_do_run: [],
    candidatos_do_preparo: m.candidatos_do_preparo,
    na_lista: m.listas.na_lista,
    lista_recusada: m.listas.lista_recusada,
    notas_ativas: m.listas.notas_ativas,
    ...(entrada.casa_da_mensagem
      ? { casa_da_mensagem: nomesDaCasaDaMensagem(entrada.casa_da_mensagem, kb) }
      : {}),
    ...gostoDaMensagem(entrada, kb),
    ...(entrada.retorno ? { retorno: entrada.retorno } : {}),
    retornos_pendentes: retornosPendentes(entrada, pendentes, c.dia, perfil.cidade_fuso),
    ...(entrada.fato_de_rotina ? { fato_de_rotina: entrada.fato_de_rotina } : {}),
  }
}

function retornosPendentes(
  entrada: EntradaDoAcompanhante,
  pendentes: Awaited<ReturnType<Stores["outcomes"]["pendentes"]>>,
  dia: string,
  fuso: string | null,
): DadosDoPreparo["retornos_pendentes"] {
  if (!entrada.retorno || entrada.retorno.registrado) return []
  return pendentes.slice(0, config.conversa.interprete.pendentesNoContexto).map((r, i) => ({
    n: i + 1,
    retorno_id: r.id,
    tipo: r.sugestao.tipo,
    titulo: r.sugestao.titulo,
    ha_dias: diasEntre(diaLocal(new Date(r.criado_em), fuso ?? undefined), dia),
  }))
}

function nomesDaCasaDaMensagem(
  casa: { tem: string[]; acabou: string[] },
  kb: KnowledgeBase,
): { tem: string[]; acabou: string[] } {
  const nomes = (ids: string[]) => ids.map((id) => kb.alimento(id)?.nome ?? id)
  return { tem: nomes(casa.tem), acabou: nomes(casa.acabou) }
}

function gostoDaMensagem(
  entrada: EntradaDoAcompanhante,
  kb: KnowledgeBase,
): Pick<DadosDoPreparo, "gosta_da_mensagem"> {
  const nomes = (entrada.gosta_da_mensagem ?? []).flatMap((id) => {
    const nome = kb.alimento(id)?.nome
    return nome ? [nome] : []
  })
  return nomes.length > 0 ? { gosta_da_mensagem: nomes } : {}
}
