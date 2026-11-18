import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import { montarFiltro } from "@/core/filtro-da-pessoa"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Run } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import {
  detectarAjudaEmEstado,
  detectarEstadosJuntos,
  type MomentoRegistrado,
  type PadraoDetectado,
  type RetornoRegistrado,
} from "./detectar"
import type { Padrao } from "./ports"
import { chaveDoItem, type ItemDoPadrao, lerChave } from "./textos"
import { padraoVale } from "./vale"

type DepsDoJob = { stores: Stores; kb: KnowledgeBase; clock: Clock; telemetry: Telemetry }

export type ResultadoDaDeteccao = { contas: number; propostos: number; falhas: number }

const DIA_MS = 86_400_000

function inicioDaJanela(clock: Clock): Date {
  return new Date(clock.now().getTime() - config.padroes.janelaDias * DIA_MS)
}

function runsValidos(runs: Run[]): Map<string, Run> {
  const validos = new Map<string, Run>()
  for (const r of runs) {
    if (r.momento && r.momento.estados.length > 0 && !r.com_incomodo) validos.set(r.id, r)
  }
  return validos
}

function itemDaSugestao(
  kb: KnowledgeBase,
  sugestao: { pratica_id?: string | null; preparo_id?: string | null },
): ItemDoPadrao | undefined {
  if (sugestao.pratica_id) {
    const pratica = kb.pratica(sugestao.pratica_id)
    if (!pratica) return undefined
    return pratica.tipo === "cha" ? { tipo: "cha" } : { tipo: "pratica", id: sugestao.pratica_id }
  }
  if (sugestao.preparo_id) return { tipo: "preparo", id: sugestao.preparo_id }
  return undefined
}

async function retornosDosRuns(
  stores: Stores,
  kb: KnowledgeBase,
  contaId: string,
  desde: Date,
  runs: Map<string, Run>,
): Promise<RetornoRegistrado[]> {
  const saida: RetornoRegistrado[] = []
  for (const r of await stores.outcomes.respondidosDesde(contaId, desde)) {
    const run = runs.get(r.run_id)
    const { resultado, sugestao } = r
    if (!run?.momento || (resultado !== "ajudou" && resultado !== "nao_ajudou")) continue
    const item = itemDaSugestao(kb, sugestao)
    if (!item) continue
    saida.push({
      dia: run.dia,
      estados: run.momento.estados,
      item,
      titulo: sugestao.titulo,
      resultado,
      respondido_em: r.respondido_em ?? r.criado_em,
    })
  }
  return saida
}

function paresGuardados(guardados: Padrao[]): Set<string> {
  const pares = new Set<string>()
  for (const g of guardados) {
    const lida = g.tipo === "estados_juntos" ? lerChave(g.tipo, g.chave) : undefined
    const [a, b] = lida?.estados ?? []
    if (a && b) {
      pares.add(`${a}>${b}`)
      pares.add(`${b}>${a}`)
    }
  }
  return pares
}

function estadosPorItem(guardados: Padrao[]): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>()
  for (const g of guardados) {
    const lida = g.tipo === "ajuda_em_estado" ? lerChave(g.tipo, g.chave) : undefined
    if (!lida?.item) continue
    const k = chaveDoItem(lida.item)
    const conjunto = mapa.get(k) ?? new Set<string>()
    for (const e of lida.estados) conjunto.add(e)
    mapa.set(k, conjunto)
  }
  return mapa
}

function semOsGuardados(detectados: PadraoDetectado[], guardados: Padrao[]): PadraoDetectado[] {
  const pares = paresGuardados(guardados)
  const porItem = estadosPorItem(guardados)
  return detectados.filter((p) => {
    if (p.tipo === "estados_juntos") return !pares.has(p.chave)
    const lida = lerChave(p.tipo, p.chave)
    if (!lida?.item) return false
    const jaTem = porItem.get(chaveDoItem(lida.item))
    return !lida.estados.some((e) => jaTem?.has(e))
  })
}

function ordenar(a: PadraoDetectado, b: PadraoDetectado): number {
  if (a.ocorrencias !== b.ocorrencias) return b.ocorrencias - a.ocorrencias
  if (a.tipo !== b.tipo) return a.tipo === "ajuda_em_estado" ? -1 : 1
  if (a.chave === b.chave) return 0
  return a.chave < b.chave ? -1 : 1
}

async function detectadosDaConta(deps: DepsDoJob, contaId: string): Promise<PadraoDetectado[]> {
  const { stores, kb, clock } = deps
  const desde = inicioDaJanela(clock)
  const runs = runsValidos(await stores.runs.recentes(contaId, desde, config.padroes.runsPorConta))
  const momentos: MomentoRegistrado[] = [...runs.values()].map((r) => ({
    dia: r.dia,
    estados: r.momento?.estados ?? [],
  }))
  const retornos = await retornosDosRuns(stores, kb, contaId, desde, runs)
  const detectados = [...detectarAjudaEmEstado(retornos), ...detectarEstadosJuntos(momentos)]
  if (detectados.length === 0) return []
  const [perfil, preferencias] = await Promise.all([
    stores.profiles.ler(contaId),
    stores.preferences.ler(contaId),
  ])
  const { filtro } = montarFiltro({ perfil, evitarDoDia: [], evitarDaMensagem: [], preferencias })
  return detectados.filter((p) => padraoVale(p, filtro, kb))
}

export async function detectarPadroesDaConta(deps: DepsDoJob, contaId: string): Promise<number> {
  const { stores, telemetry } = deps
  const detectados = await detectadosDaConta(deps, contaId)
  if (detectados.length === 0) return 0
  const guardados = await stores.patterns.listar(contaId)
  let abertos = guardados.filter((p) => p.status === "candidato").length
  let propostos = 0
  for (const p of semOsGuardados(detectados, guardados).sort(ordenar)) {
    if (abertos >= config.padroes.maxCandidatosAbertos) break
    const criado = await stores.patterns.propor(contaId, {
      tipo: p.tipo,
      chave: p.chave,
      frase: p.frase,
      ocorrencias: p.ocorrencias,
    })
    if (!criado) continue
    abertos += 1
    propostos += 1
    telemetry.contador("ritu_padroes_total", { tipo: p.tipo, etapa: "detectado" })
  }
  return propostos
}

export async function detectarPadroes(deps: DepsDoJob): Promise<ResultadoDaDeteccao> {
  const { stores, telemetry, clock } = deps
  return telemetry.span("padroes.deteccao", {}, async (span) => {
    const resultado: ResultadoDaDeteccao = { contas: 0, propostos: 0, falhas: 0 }
    for (const contaId of await stores.runs.contasComRunDesde(inicioDaJanela(clock))) {
      resultado.contas += 1
      try {
        resultado.propostos += await detectarPadroesDaConta(deps, contaId)
      } catch (e) {
        resultado.falhas += 1
        telemetry.log("padroes_conta_falhou", {
          "erro.codigo": e instanceof RituError ? e.code : "desconhecido",
        })
      }
    }
    span.atribuir({ "padroes.contas": resultado.contas, "padroes.propostos": resultado.propostos })
    return resultado
  })
}
