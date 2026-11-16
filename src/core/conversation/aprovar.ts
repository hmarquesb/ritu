import { config } from "@config/index"
import { z } from "zod"
import { RituError } from "@/core/errors"
import {
  type ConteudoDaProposta,
  lerConteudo,
  type PropostaNaSaida,
} from "@/core/proposals/conteudo"
import { executarProposta } from "@/core/proposals/executor"
import type { Proposta } from "@/core/proposals/ports"
import { textoDaProposta } from "@/core/proposals/textos"
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

type DepsDaAprovacao = Pick<Deps, "stores" | "tx" | "kb" | "clock" | "telemetry" | "runs">

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

type Decidida = { proposta: Proposta; gravada: boolean }

function ehFezFalta(p: Proposta): boolean {
  const c = lerConteudo(p.tool, p.conteudo)
  return c?.tool === "lista.propor" && c.motivo === "fez_falta"
}

function itensDeGosto(p: Proposta): number {
  const c = lerConteudo(p.tool, p.conteudo)
  return c?.tool === "memoria.propor" && c.tipo === "gosta" ? c.itens.length : 0
}

export function criarAprovar(deps: DepsDaAprovacao) {
  const { stores, tx, kb, clock, telemetry, runs } = deps

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

  async function decidirUma(
    s: Stores,
    contaId: string,
    runId: string,
    p: Proposta,
    escolhida: boolean,
  ): Promise<boolean> {
    const gravada = escolhida && (await executarProposta(s, contaId, p.tool, p.conteudo, kb))
    await s.proposals.decidir(contaId, p.id, gravada ? "aprovada" : "recusada")
    if (escolhida && !gravada) await s.runs.acrescentarEtapa(contaId, runId, ETAPA_INVALIDA)
    return gravada
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
        const gravada = await decidirUma(s, contaId, runId, p, aprovadas.has(p.id))
        decididas.push({ proposta: p, gravada })
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
    for (const { proposta: p, gravada } of decididas) {
      const decisao = gravada ? "aprovada" : "recusada"
      telemetry.contador("ritu_propostas_total", { tool: p.tool, decisao })
      if (ehFezFalta(p)) telemetry.contador("ritu_para_ter_total", { etapa: decisao })
      if (gravada) {
        const gostos = itensDeGosto(p)
        if (gostos > 0) telemetry.contador("ritu_gosto_total", { gosto: "gosta" }, gostos)
      }
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
    const decididas = await runs.comSpanDoRun(contaId, runId, () =>
      telemetry.span("aprovacao.execucao", {}, async (span) => {
        const r = await gravarDecisoes(contaId, runId, pendentes, escolhidas)
        if (!r) return undefined
        span.atribuir({
          "propostas.total": r.length,
          "propostas.aprovadas": r.filter((d) => d.gravada).length,
        })
        somarMetricas(r)
        return r
      }),
    )
    if (!decididas) throw naoContinuavel()
    return {
      run_id: runId,
      status: "done",
      gravadas: decididas.filter((d) => d.gravada).flatMap((d) => comoNaSaida(d.proposta)),
      recusadas: decididas.filter((d) => !d.gravada).map((d) => d.proposta.id),
    }
  }
}
