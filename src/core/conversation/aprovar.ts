import { config } from "@config/index"
import { z } from "zod"
import { RituError } from "@/core/errors"
import type { TipoPadrao } from "@/core/patterns/ports"
import {
  type ConteudoDaProposta,
  lerConteudo,
  type PropostaNaSaida,
} from "@/core/proposals/conteudo"
import { executarProposta } from "@/core/proposals/executor"
import type { Proposta } from "@/core/proposals/ports"
import { textoDaProposta } from "@/core/proposals/textos"
import { atualizarResumo } from "@/core/routine/resumo"
import { pendenciaSchema } from "@/core/runs/checkpoint"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import type { Stores } from "@/core/stores"
import type { Deps } from "./conversar"

export type ResultadoDaAprovacao = {
  run_id: string
  status: "done"
  gravadas: PropostaNaSaida[]
  recusadas: string[]
}

type DepsDaAprovacao = Pick<
  Deps,
  "stores" | "tx" | "kb" | "clock" | "telemetry" | "runs" | "memory"
>

const conteudoDoBlocoSchema = z.object({ propostas: z.array(z.string()) })

const naoContinuavel = () => new RunNaoContinuavelError()

const ETAPA_INVALIDA = {
  tipo: "erro",
  nome: "proposta_invalida",
  status: "falhou",
  resumo: null,
  duracao_ms: 0,
  modelo: null,
  tokens_entrada: 0,
  tokens_saida: 0,
} as const

type DoPadrao = { tipo: TipoPadrao; etapa: "confirmado" | "recusado" }
type Decidida = { proposta: Proposta; gravada: boolean; padrao?: DoPadrao }

const ETAPA_SEM_RESUMO = {
  tipo: "erro",
  nome: "resumo_de_rotina",
  status: "falhou",
  resumo: null,
  duracao_ms: 0,
  modelo: null,
  tokens_entrada: 0,
  tokens_saida: 0,
} as const

function ehRotina(p: Proposta): boolean {
  const c = lerConteudo(p.tool, p.conteudo)
  return c?.tool === "memoria.propor" && c.tipo === "rotina"
}

function ehFezFalta(p: Proposta): boolean {
  const c = lerConteudo(p.tool, p.conteudo)
  return c?.tool === "lista.propor" && c.motivo === "fez_falta"
}

function itensDeGosto(p: Proposta): number {
  const c = lerConteudo(p.tool, p.conteudo)
  return c?.tool === "memoria.propor" && c.tipo === "gosta" ? c.itens.length : 0
}

export function criarAprovar(deps: DepsDaAprovacao) {
  const { stores, tx, kb, clock, telemetry, runs, memory } = deps

  async function lerBloco(contaId: string, runId: string) {
    const run = await stores.runs.buscar(contaId, runId)
    if (run?.status !== "waiting_for_approval") throw naoContinuavel()
    const pendencia = pendenciaSchema.safeParse(run.pendencia)
    if (!pendencia.success || pendencia.data.tipo !== "aprovacao") throw naoContinuavel()
    const conteudo = conteudoDoBlocoSchema.safeParse(pendencia.data.conteudo)
    if (!conteudo.success) throw naoContinuavel()
    return { ids: conteudo.data.propostas, criadaEm: pendencia.data.criada_em }
  }

  async function expirar(contaId: string, runId: string): Promise<never> {
    const mudou = await tx.emTransacao(async (s) => {
      const ok = await s.runs.mudarStatusSe(contaId, runId, "waiting_for_approval", "expired")
      if (ok) await s.proposals.expirarDosRuns([runId])
      return ok
    })
    if (!mudou) throw naoContinuavel()
    throw new RituError("aprovacao_expirada", "A aprovação expirou")
  }

  async function pendentesDoBloco(contaId: string, runId: string, ids: string[]) {
    const doRun = await stores.proposals.doRun(contaId, runId)
    return ids.flatMap((id) => {
      const p = doRun.find((x) => x.id === id && x.decisao === "pendente")
      return p ? [p] : []
    })
  }

  async function candidatoDaProposta(s: Stores, contaId: string, p: Proposta) {
    const c = lerConteudo(p.tool, p.conteudo)
    if (c?.tool !== "padrao.confirmar") return undefined
    const candidatos = await s.patterns.listar(contaId, "candidato")
    return candidatos.find((x) => x.id === c.padrao_id)
  }

  // Padrão não aprovado num "Anotar" com outras linhas ligadas: recusado (a pessoa viu e desligou).
  async function decidirUma(
    s: Stores,
    contaId: string,
    runId: string,
    p: Proposta,
    escolhidas: Set<string>,
  ): Promise<Decidida> {
    const escolhida = escolhidas.has(p.id)
    const candidato = await candidatoDaProposta(s, contaId, p)
    const gravada = escolhida && (await executarProposta(s, contaId, p.tool, p.conteudo, kb))
    await s.proposals.decidir(contaId, p.id, gravada ? "aprovada" : "recusada")
    if (escolhida && !gravada) await s.runs.acrescentarEtapa(contaId, runId, ETAPA_INVALIDA)
    if (!candidato) return { proposta: p, gravada }
    if (gravada)
      return { proposta: p, gravada, padrao: { tipo: candidato.tipo, etapa: "confirmado" } }
    if (escolhidas.size === 0) return { proposta: p, gravada }
    await s.patterns.decidir(contaId, candidato.id, "recusado")
    return { proposta: p, gravada, padrao: { tipo: candidato.tipo, etapa: "recusado" } }
  }

  // Uma transação só, que começa pela troca de status: perde quem chegar depois (D10).
  async function gravarDecisoes(
    contaId: string,
    runId: string,
    pendentes: Proposta[],
    aprovadas: Set<string>,
  ): Promise<Decidida[] | undefined> {
    return tx.emTransacao(async (s) => {
      if (!(await s.runs.mudarStatusSe(contaId, runId, "waiting_for_approval", "done"))) {
        return undefined
      }
      const decididas: Decidida[] = []
      for (const p of pendentes) {
        decididas.push(await decidirUma(s, contaId, runId, p, aprovadas))
      }
      const n = decididas.filter((d) => d.gravada).length
      await s.runs.acrescentarEtapa(contaId, runId, {
        tipo: "aprovacao",
        nome: "aprovacao",
        status: "ok",
        resumo: `${n} de ${pendentes.length}`,
        duracao_ms: 0,
        modelo: null,
        tokens_entrada: 0,
        tokens_saida: 0,
      })
      return decididas
    })
  }

  function somarMetricas(decididas: Decidida[]) {
    for (const { proposta: p, gravada, padrao } of decididas) {
      const decisao = gravada ? "aprovada" : "recusada"
      if (padrao) telemetry.contador("ritu_padroes_total", { ...padrao })
      telemetry.contador("ritu_propostas_total", { tool: p.tool, decisao })
      if (ehFezFalta(p)) telemetry.contador("ritu_para_ter_total", { etapa: decisao })
      if (gravada) somarGostos(p)
    }
  }

  function somarGostos(p: Proposta) {
    const gostos = itensDeGosto(p)
    if (gostos > 0) telemetry.contador("ritu_gosto_total", { gosto: "gosta" }, gostos)
  }

  // Falha do resumo não derruba a aprovação: as notas já estão gravadas (D10).
  async function atualizarEAnotar(contaId: string, runId: string) {
    try {
      const r = await atualizarResumo({ stores, memory, telemetry }, contaId)
      await runs.gravarEtapa(contaId, runId, {
        tipo: "memoria",
        nome: "resumo_de_rotina",
        status: "ok",
        resumo: r.origem,
        duracao_ms: r.duracao_ms,
        modelo: r.modelo ?? null,
        tokens_entrada: r.tokens.entrada,
        tokens_saida: r.tokens.saida,
      })
    } catch {
      await runs.gravarEtapa(contaId, runId, ETAPA_SEM_RESUMO).catch(() => undefined)
    }
  }

  function comoNaSaida(p: Proposta): PropostaNaSaida[] {
    const c: ConteudoDaProposta | undefined = lerConteudo(p.tool, p.conteudo)
    return c ? [{ id: p.id, tool: c.tool, texto: textoDaProposta(c, kb) }] : []
  }

  return async function aprovar(
    contaId: string,
    runId: string,
    aprovadas: string[],
  ): Promise<ResultadoDaAprovacao> {
    const { ids, criadaEm } = await lerBloco(contaId, runId)
    const espera = config.memoria.esperaMinutos * 60_000
    if (clock.now().getTime() - new Date(criadaEm).getTime() > espera) {
      return expirar(contaId, runId)
    }
    const pendentes = await pendentesDoBloco(contaId, runId, ids)
    const escolhidas = new Set(aprovadas)
    if ([...escolhidas].some((id) => !pendentes.some((p) => p.id === id))) {
      throw new RituError("aprovacao_invalida", "Aprovação inválida")
    }
    const decididas = await runs.comSpanDoRun(contaId, runId, async () => {
      const r = await telemetry.span("aprovacao.execucao", {}, async (span) => {
        const feitas = await gravarDecisoes(contaId, runId, pendentes, escolhidas)
        if (!feitas) return undefined
        span.atribuir({
          "propostas.total": feitas.length,
          "propostas.aprovadas": feitas.filter((d) => d.gravada).length,
        })
        somarMetricas(feitas)
        return feitas
      })
      if (r?.some((d) => d.gravada && ehRotina(d.proposta))) {
        await atualizarEAnotar(contaId, runId)
      }
      return r
    })
    if (!decididas) throw naoContinuavel()
    return {
      run_id: runId,
      status: "done",
      gravadas: decididas.filter((d) => d.gravada).flatMap((d) => comoNaSaida(d.proposta)),
      recusadas: decididas.filter((d) => !d.gravada).map((d) => d.proposta.id),
    }
  }
}
