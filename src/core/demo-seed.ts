import { z } from "zod"
import { saidaDoAcompanhanteSchema } from "@/core/agents/companion/saida"
import type { EvitarItem, FiltroPessoa } from "@/core/knowledge/filtros"
import { passaNoFiltro } from "@/core/knowledge/filtros"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento, Pratica, Preparo } from "@/core/knowledge/schemas"
import {
  estadoSchema,
  gunaSchema,
  momentoDoDiaSchema,
  restricaoSchema,
} from "@/core/knowledge/vocab"
import { prakritiSchema } from "@/core/memory-schemas"
import { type EstadoCalculado, estadoDoItem } from "@/core/pantry/estado"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { CidadeDaPessoa } from "@/core/weather/ports"

const cidadeDaPessoaSchema: z.ZodType<CidadeDaPessoa> = z.strictObject({
  nome: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  fuso: z.string().min(1),
})

const evitarItemSchema: z.ZodType<EvitarItem> = z.strictObject({
  tipo: z.enum(["grupo", "alimento", "texto"]),
  valor: z.string(),
})

export const demoSeedSchema = z.strictObject({
  faixa: z.string().max(140),
  mensagem_sugerida: z.string().max(200),
  perfil: z.strictObject({
    prakriti: prakritiSchema,
    cidade: cidadeDaPessoaSchema,
    evitar_sempre: z.array(evitarItemSchema),
    restricoes: z.array(restricaoSchema),
    nao_come: z.array(z.strictObject({ tipo: z.enum(["alimento", "texto"]), valor: z.string() })),
  }),
  casa: z.array(
    z.strictObject({
      alimento_id: z.string(),
      dias_atras: z.number().int().min(0),
      sempre_tenho: z.boolean().optional(),
    }),
  ),
  preferencias: z.array(
    z.strictObject({
      tipo: z.enum(["alimento", "pratica", "preparo"]),
      id: z.string(),
      gosto: z.enum(["gosta", "nao_gosta"]).optional(),
      ajudou: z.number().int().min(0).optional(),
      nao_ajudou: z.number().int().min(0).optional(),
      nao_fez: z.number().int().min(0).optional(),
    }),
  ),
  faltas: z.array(
    z.strictObject({
      alimento_id: z.string(),
      dias_atras: z.number().int().min(1).max(29),
    }),
  ),
  rotina: z.array(z.string().max(200)).max(5),
  padrao: z.strictObject({
    estados: z.array(estadoSchema).min(1).max(2),
    item: z.union([
      z.strictObject({ tipo: z.enum(["pratica", "preparo"]), id: z.string() }),
      z.strictObject({ tipo: z.literal("cha") }),
    ]),
    ocorrencias: z.number().int().min(3),
  }),
  historico: z
    .array(
      z.strictObject({
        dias_atras: z.number().int().min(1).max(6),
        mensagem: z.string().max(1000),
        estados: z.array(estadoSchema),
        momento_do_dia: momentoDoDiaSchema,
        gunas_buscadas: z.array(gunaSchema),
        saida: saidaDoAcompanhanteSchema, // a resposta é saida.resposta
        resultados: z.array(z.enum(["ajudou", "nao_ajudou", "nao_fez", "aguardando"])), // um por sugestão de saida.sugestoes
      }),
    )
    .min(3)
    .max(6),
})

export type DemoSeed = z.infer<typeof demoSeedSchema>

type Historico = DemoSeed["historico"][number]
type Sugestao = Historico["saida"]["sugestoes"][number]
type Tipo = "alimento" | "pratica" | "preparo"

const DIA_EM_MS = 86_400_000
const CASA_CONFIRMADOS = { min: 5, max: 12 }
const CASA_INCERTOS = { min: 2, max: 4 }
const FALTA_DIAS_MINIMOS = 3
const AGUARDANDO_MINIMOS = 2
const PADRAO_CONVERSAS_MINIMAS = 3

function alvoDaBase(
  kb: KnowledgeBase,
  tipo: Tipo,
  id: string,
): Alimento | Pratica | Preparo | undefined {
  if (tipo === "alimento") return kb.alimento(id)
  if (tipo === "pratica") return kb.pratica(id)
  return kb.preparo(id)
}

function idsDaBase(seed: DemoSeed, kb: KnowledgeBase): string[] {
  const erros: string[] = []
  const exige = (tipo: Tipo, id: string, onde: string) => {
    if (!alvoDaBase(kb, tipo, id)) erros.push(`${onde}: ${tipo} "${id}" não existe na base`)
  }
  for (const c of seed.casa) exige("alimento", c.alimento_id, "casa")
  for (const f of seed.faltas) exige("alimento", f.alimento_id, "faltas")
  for (const p of seed.preferencias) exige(p.tipo, p.id, "preferências")
  if (seed.padrao.item.tipo !== "cha") {
    exige(seed.padrao.item.tipo, seed.padrao.item.id, "padrão")
  }
  for (const e of seed.perfil.evitar_sempre) {
    if (e.tipo === "alimento") exige("alimento", e.valor, "evitar_sempre")
    if (e.tipo === "grupo" && !kb.gruposEvitar.some((g) => g.id === e.valor)) {
      erros.push(`evitar_sempre: grupo "${e.valor}" não existe na base`)
    }
  }
  for (const n of seed.perfil.nao_come) {
    if (n.tipo === "alimento") exige("alimento", n.valor, "nao_come")
  }
  return erros
}

function faltaNaBase(kb: KnowledgeBase, tipo: Tipo, id: string, onde: string): string[] {
  return alvoDaBase(kb, tipo, id) ? [] : [`${onde}: ${tipo} "${id}" não existe na base`]
}

function idsDaSugestao(s: Sugestao, kb: KnowledgeBase): string[] {
  const erros = [
    ...(s.pratica_id ? faltaNaBase(kb, "pratica", s.pratica_id, "saida") : []),
    ...(s.preparo_id ? faltaNaBase(kb, "preparo", s.preparo_id, "saida") : []),
  ]
  for (const item of s.itens) {
    erros.push(...faltaNaBase(kb, "alimento", item.alimento_id, "saida"))
    if (item.se_faltar)
      erros.push(...faltaNaBase(kb, "alimento", item.se_faltar.alimento_id, "saida"))
    if (item.troca) erros.push(...faltaNaBase(kb, "alimento", item.troca.alimento_id, "saida"))
  }
  return erros
}

function idsDaSaida(saida: Historico["saida"], kb: KnowledgeBase): string[] {
  const erros = saida.sugestoes.flatMap((s) => idsDaSugestao(s, kb))
  if (saida.para_ter)
    erros.push(...faltaNaBase(kb, "alimento", saida.para_ter.alimento_id, "saida"))
  for (const ref of saida.citados) {
    if (kb.linha(ref) === undefined) erros.push(`saida: "${ref}" não existe na base`)
  }
  return erros
}

function checarIds(seed: DemoSeed, kb: KnowledgeBase): string[] {
  return [...idsDaBase(seed, kb), ...seed.historico.flatMap((h) => idsDaSaida(h.saida, kb))]
}

// Só o evitar_sempre entra aqui: restrição e "não come" não são o que esta checagem confere.
function filtroDoSeed(seed: DemoSeed): FiltroPessoa {
  return { evitar: seed.perfil.evitar_sempre, restricoes: [], nao_come: [], nao_gosta: [] }
}

function checarFiltro(seed: DemoSeed, kb: KnowledgeBase): string[] {
  const filtro = filtroDoSeed(seed)
  const erros: string[] = []
  const confere = (tipo: Tipo, id: string, onde: string) => {
    const alvo = alvoDaBase(kb, tipo, id)
    if (alvo && !passaNoFiltro(alvo, filtro, kb).passa) {
      erros.push(`${onde}: "${id}" bate em evitar_sempre`)
    }
  }
  for (const c of seed.casa) confere("alimento", c.alimento_id, "casa")
  for (const p of seed.preferencias) confere(p.tipo, p.id, "preferências")
  for (const f of seed.faltas) confere("alimento", f.alimento_id, "faltas")
  for (const h of seed.historico) {
    for (const s of h.saida.sugestoes) {
      if (s.pratica_id) confere("pratica", s.pratica_id, "sugestão")
      if (s.preparo_id) confere("preparo", s.preparo_id, "sugestão")
      for (const item of s.itens) confere("alimento", item.alimento_id, "sugestão")
    }
  }
  return erros
}

function estadoDaCasa(
  item: DemoSeed["casa"][number],
  kb: KnowledgeBase,
  agora: Date,
): EstadoCalculado | undefined {
  const alimento = kb.alimento(item.alimento_id)
  if (!alimento) return undefined
  // A casa só é contada aqui; a conta não entra no cálculo do estado.
  const casa: ItemDaCasa = {
    id: item.alimento_id,
    conta_id: "",
    alimento_id: item.alimento_id,
    nome_livre: null,
    nome_normalizado: null,
    estado: "tem",
    sempre_tenho: item.sempre_tenho ?? false,
    confirmado_em: new Date(agora.getTime() - item.dias_atras * DIA_EM_MS).toISOString(),
    origem: "conversa",
  }
  return estadoDoItem(casa, agora, alimento.durabilidade)
}

function checarCasa(seed: DemoSeed, kb: KnowledgeBase, agora: Date): string[] {
  const estados = seed.casa
    .map((item) => estadoDaCasa(item, kb, agora))
    .filter((estado): estado is EstadoCalculado => estado !== undefined)
  const confirmados = estados.filter((e) => e === "confirmado" || e === "sempre_tenho").length
  const incertos = estados.filter((e) => e === "incerto").length
  const erros: string[] = []
  if (confirmados < CASA_CONFIRMADOS.min || confirmados > CASA_CONFIRMADOS.max) {
    erros.push(
      `casa: ${confirmados} itens confirmados; o esperado é de ${CASA_CONFIRMADOS.min} a ${CASA_CONFIRMADOS.max}`,
    )
  }
  if (incertos < CASA_INCERTOS.min || incertos > CASA_INCERTOS.max) {
    erros.push(
      `casa: ${incertos} itens incertos; o esperado é de ${CASA_INCERTOS.min} a ${CASA_INCERTOS.max}`,
    )
  }
  return erros
}

function checarFaltas(seed: DemoSeed): string[] {
  const diasPorAlimento = new Map<string, Set<number>>()
  for (const falta of seed.faltas) {
    const dias = diasPorAlimento.get(falta.alimento_id) ?? new Set<number>()
    dias.add(falta.dias_atras)
    diasPorAlimento.set(falta.alimento_id, dias)
  }
  const algumRepetido = [...diasPorAlimento.values()].some(
    (dias) => dias.size >= FALTA_DIAS_MINIMOS,
  )
  return algumRepetido
    ? []
    : [`faltas: nenhum alimento falta em ${FALTA_DIAS_MINIMOS} dias diferentes`]
}

function ehDoItemDoPadrao(sugestao: Sugestao, item: DemoSeed["padrao"]["item"]): boolean {
  if (item.tipo === "cha") return sugestao.pratica_id?.startsWith("cha-") === true
  return item.tipo === "pratica" ? sugestao.pratica_id === item.id : sugestao.preparo_id === item.id
}

function cumpreOPadrao(h: Historico, padrao: DemoSeed["padrao"]): boolean {
  const todosOsEstados = padrao.estados.every((estado) => h.estados.includes(estado))
  const ajudou = h.saida.sugestoes.some(
    (s, i) => h.resultados[i] === "ajudou" && ehDoItemDoPadrao(s, padrao.item),
  )
  return todosOsEstados && ajudou
}

function checarHistorico(seed: DemoSeed, kb: KnowledgeBase): string[] {
  const erros: string[] = []
  for (const [i, h] of seed.historico.entries()) {
    const onde = `historico ${i + 1}`
    if (h.resultados.length !== h.saida.sugestoes.length) {
      erros.push(
        `${onde}: ${h.resultados.length} resultados para ${h.saida.sugestoes.length} sugestões`,
      )
    }
    if (contemIncomodo(h.mensagem, kb) || contemIncomodo(h.saida.resposta, kb)) {
      erros.push(`${onde}: mensagem ou resposta cita um incômodo`)
    }
  }
  const aguardando = seed.historico
    .flatMap((h) => h.resultados)
    .filter((r) => r === "aguardando").length
  if (aguardando < AGUARDANDO_MINIMOS) {
    erros.push(
      `historico: ${aguardando} retornos aguardando; o esperado é de ${AGUARDANDO_MINIMOS} ou mais`,
    )
  }
  const conversas = seed.historico.filter((h) => cumpreOPadrao(h, seed.padrao)).length
  if (conversas < PADRAO_CONVERSAS_MINIMAS) {
    erros.push(
      `historico: ${conversas} conversas com o padrão ajudou; o esperado é de ${PADRAO_CONVERSAS_MINIMAS} ou mais`,
    )
  }
  return erros
}

function textosComAngulo(valor: unknown, caminho: string): string[] {
  if (typeof valor === "string") return /[<>]/.test(valor) ? [`${caminho}: texto com < ou >`] : []
  if (Array.isArray(valor)) return valor.flatMap((v, i) => textosComAngulo(v, `${caminho}[${i}]`))
  if (valor !== null && typeof valor === "object") {
    return Object.entries(valor).flatMap(([chave, v]) =>
      textosComAngulo(v, caminho === "" ? chave : `${caminho}.${chave}`),
    )
  }
  return []
}

// Erros de conferência do seed contra a base; lista vazia quer dizer válido.
export function validarSeed(seed: DemoSeed, kb: KnowledgeBase, agora: Date): string[] {
  return [
    ...checarIds(seed, kb),
    ...checarFiltro(seed, kb),
    ...checarCasa(seed, kb, agora),
    ...checarFaltas(seed),
    ...checarHistorico(seed, kb),
    ...textosComAngulo(seed, ""),
  ]
}
