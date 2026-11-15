import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { FornecedorDeModelo } from "@/core/llm/fornecedor"
import type { Stores, Transactor } from "@/core/stores"
import type { SpanAtivo, Telemetry } from "@/core/telemetry/ports"
import { diaLocal } from "@/core/time/dia-local"
import type { ToolContext } from "@/core/tools/tool"
import type { AgentRuntime } from "./agent-runtime"
import type { DefinicaoDoAgente, Pendencia } from "./agente"
import { type Checkpoint, lerCheckpoint, pendenciaSchema } from "./checkpoint"
import { RunAbertoError, RunNaoContinuavelError } from "./errors"
import { podeIr } from "./estados"
import { type EventoAoVivo, executarTrecho, type FimDoTrecho, retomarCheckpoint } from "./loop"
import type { Caminho, NovaEtapa, Run, RunEtapa, RunMutavel, StatusRun } from "./ports"

export { RunNaoContinuavelError } from "./errors"
export type { NovaEtapa, TipoDeEtapa } from "./ports"
export type ResultadoDoRun = { run: Run; fim: FimDoTrecho }

type Execucao = {
  agente: DefinicaoDoAgente
  ctx: ToolContext
  modelo: FornecedorDeModelo
  aoGravarEtapa?: (e: RunEtapa) => void
  aoVivo?: (e: EventoAoVivo) => void
}

type DepsDoServico = {
  stores: Stores
  tx: Transactor
  runtime: AgentRuntime
  clock: Clock
  telemetry: Telemetry
}

const INESPERADO: FimDoTrecho = { tipo: "erro", codigo: "inesperado" }

function transicaoInvalida(): RituError {
  return new RituError("transicao_invalida", "Transição de estado inválida")
}

function etapaDeErro(codigo: string): NovaEtapa {
  return {
    tipo: "erro",
    nome: codigo,
    status: "falhou",
    duracao_ms: 0,
    resumo: null,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  }
}

async function mudarStatus(
  stores: Stores,
  contaId: string,
  run: Run,
  para: StatusRun,
  campos: Partial<RunMutavel> = {},
): Promise<void> {
  if (!podeIr(run.status, para)) throw transicaoInvalida()
  await stores.runs.atualizar(contaId, run.id, { ...campos, status: para })
}

export function createRunService(deps: DepsDoServico) {
  const { stores, tx, clock, telemetry } = deps

  async function buscarOuFalhar(contaId: string, runId: string): Promise<Run> {
    const run = await stores.runs.buscar(contaId, runId)
    if (!run) throw new RituError("run_nao_encontrado", "Run não encontrado")
    return run
  }

  async function gravarEtapa(contaId: string, runId: string, etapa: NovaEtapa): Promise<RunEtapa> {
    return stores.runs.acrescentarEtapa(contaId, runId, etapa)
  }

  async function encerrar(
    contaId: string,
    runId: string,
    status: "done" | "failed" | "cancelled",
    campos: Partial<RunMutavel> = {},
  ): Promise<void> {
    const run = await buscarOuFalhar(contaId, runId)
    await mudarStatus(stores, contaId, run, status, campos)
    telemetry.log("info", "run_fim", {
      "run.id": runId,
      "run.status": status,
      ...(run.trace_id ? { trace_id: run.trace_id } : {}),
    })
  }

  async function falhar(contaId: string, runId: string, codigo: string): Promise<Run> {
    await gravarEtapa(contaId, runId, etapaDeErro(codigo))
    await encerrar(contaId, runId, "failed")
    return buscarOuFalhar(contaId, runId)
  }

  async function iniciarRun(
    contaId: string,
    r: { caminho: Caminho; intencoes: string[]; fuso?: string },
  ): Promise<Run> {
    return tx.emTransacao(async (s) => {
      const aberto = await s.runs.aberto(contaId)
      if (aberto?.status === "running") throw new RunAbertoError()
      if (aberto?.status === "waiting_for_input") {
        await mudarStatus(s, contaId, aberto, "cancelled")
      } else if (aberto?.status === "waiting_for_approval") {
        await mudarStatus(s, contaId, aberto, "done")
        await s.proposals.expirarDosRuns([aberto.id])
      }
      return s.runs.criar(contaId, {
        caminho: r.caminho,
        intencoes: r.intencoes,
        dia: diaLocal(clock.now(), r.fuso),
      })
    })
  }

  async function fecharTrecho(
    contaId: string,
    runId: string,
    estado: Checkpoint,
    fim: FimDoTrecho,
  ): Promise<void> {
    const run = await buscarOuFalhar(contaId, runId)
    const campos: Partial<RunMutavel> = {
      passos: estado.chamadas_de_modelo,
      tokens_entrada: estado.tokens.entrada,
      tokens_saida: estado.tokens.saida,
      latencia_ms: estado.ativo_ms,
    }
    if (fim.tipo === "entregue") campos.saida = fim.saida
    if (fim.tipo === "pausa") {
      Object.assign(campos, { checkpoint: estado, pendencia: fim.pendencia })
      await mudarStatus(stores, contaId, run, "waiting_for_input", campos)
    } else {
      await stores.runs.atualizar(contaId, runId, campos)
    }
    telemetry.histograma("ritu_run_duracao_ms", estado.ativo_ms)
    telemetry.histograma("ritu_run_passos", estado.chamadas_de_modelo)
  }

  async function trecho(
    contaId: string,
    run: Run,
    estado: Checkpoint,
    p: Execucao,
  ): Promise<FimDoTrecho> {
    const { estado: novo, fim } = await executarTrecho(p.agente, estado, p.ctx, {
      runtime: deps.runtime,
      modelo: p.modelo,
      clock,
      telemetry,
      aoVivo: p.aoVivo,
      async gravarEtapa(e) {
        const gravada = await gravarEtapa(contaId, run.id, e)
        p.aoGravarEtapa?.(gravada)
        return gravada
      },
    })
    await fecharTrecho(contaId, run.id, novo, fim)
    return fim
  }

  const spansAbertos = new Map<string, SpanAtivo>()

  function fecharSpan(span: SpanAtivo, final: Run): void {
    span.atribuir({
      "run.status": final.status,
      "run.passos": final.passos,
      "run.caminho": final.caminho,
      "run.intencoes": final.intencoes.join(","),
    })
  }

  async function comSpanDoRun<T>(
    contaId: string,
    runId: string,
    corpo: (span: SpanAtivo) => Promise<T>,
  ): Promise<T> {
    const run = await buscarOuFalhar(contaId, runId)
    const conta = await stores.accounts.buscar(contaId)
    const traceparent = run.trace_id ?? undefined
    return telemetry.span(
      "run",
      {
        "run.id": run.id,
        "run.caminho": run.caminho,
        ...(conta ? { "conta.tipo": conta.tipo } : {}),
      },
      async (span) => {
        const id = traceparent ?? telemetry.traceparentAtual()
        if (id) await stores.runs.atualizar(contaId, runId, { trace_id: id })
        telemetry.log("info", "run_inicio", { "run.id": runId, ...(id ? { trace_id: id } : {}) })
        spansAbertos.set(runId, span)
        try {
          const resultado = await corpo(span)
          fecharSpan(span, await buscarOuFalhar(contaId, runId))
          return resultado
        } finally {
          spansAbertos.delete(runId)
        }
      },
      traceparent ? { traceparent } : undefined,
    )
  }

  async function dentroDoSpan(
    contaId: string,
    run: Run,
    p: Execucao,
    corpo: () => Promise<FimDoTrecho>,
  ): Promise<ResultadoDoRun> {
    const aberto = spansAbertos.get(run.id)
    if (aberto) {
      aberto.atribuir({ "prompt.versao": p.agente.prompt_versao })
      await stores.runs.atualizar(contaId, run.id, { prompt_versao: p.agente.prompt_versao })
      const fim = await corpo()
      return { run: await buscarOuFalhar(contaId, run.id), fim }
    }
    const conta = await stores.accounts.buscar(contaId)
    const traceparent = run.trace_id ?? undefined
    const fim = await telemetry.span(
      "run",
      {
        "run.id": run.id,
        "run.caminho": run.caminho,
        ...(conta ? { "conta.tipo": conta.tipo } : {}),
        "prompt.versao": p.agente.prompt_versao,
      },
      async (span) => {
        const atual = telemetry.traceparentAtual()
        const id = traceparent ?? atual
        await stores.runs.atualizar(contaId, run.id, {
          prompt_versao: p.agente.prompt_versao,
          ...(id ? { trace_id: id } : {}),
        })
        telemetry.log("info", "run_inicio", {
          "run.id": run.id,
          ...(id ? { trace_id: id } : {}),
        })
        const resultado = await corpo()
        const final = await buscarOuFalhar(contaId, run.id)
        span.atribuir({ "run.status": final.status, "run.passos": final.passos })
        return resultado
      },
      traceparent ? { traceparent } : undefined,
    )
    return { run: await buscarOuFalhar(contaId, run.id), fim }
  }

  async function protegido(
    contaId: string,
    run: Run,
    p: Execucao,
    corpo: () => Promise<FimDoTrecho>,
  ): Promise<ResultadoDoRun> {
    try {
      return await dentroDoSpan(contaId, run, p, corpo)
    } catch {
      const atual = await stores.runs.buscar(contaId, run.id)
      if (atual?.status === "running") await falhar(contaId, run.id, "inesperado")
      return { run: await buscarOuFalhar(contaId, run.id), fim: INESPERADO }
    }
  }

  async function executarRun(
    contaId: string,
    runId: string,
    p: Execucao & { estado: Checkpoint },
  ): Promise<ResultadoDoRun> {
    const run = await buscarOuFalhar(contaId, runId)
    if (run.status !== "running") throw transicaoInvalida()
    return protegido(contaId, run, p, () => trecho(contaId, run, p.estado, p))
  }

  function resultadoDaTool(
    p: Execucao,
    estado: Checkpoint,
    pendencia: Pendencia,
    resposta: unknown,
  ) {
    const nome = estado.mensagens
      .flatMap((m) => (m.papel === "agente" ? m.chamadas : []))
      .find((c) => c.id === pendencia.chamada_id)?.nome
    const controle = p.agente.controle.find((c) => c.name === nome)
    return controle?.aoRetomar?.(resposta, estado) ?? resposta
  }

  function lerEstado(
    run: Run,
    agente: DefinicaoDoAgente,
  ): { estado: Checkpoint; pendencia: Pendencia } | string {
    try {
      const estado = lerCheckpoint(run.checkpoint)
      const pendencia = pendenciaSchema.parse(run.pendencia) as Pendencia
      if (estado.agente !== agente.nome || estado.prompt_versao !== agente.prompt_versao) {
        return "checkpoint_incompativel"
      }
      return { estado, pendencia }
    } catch {
      return "checkpoint_invalido"
    }
  }

  async function continuarRun(
    contaId: string,
    runId: string,
    p: Execucao & { resposta: unknown; reservado?: true },
  ): Promise<ResultadoDoRun> {
    if (!p.reservado) {
      const trocou = await stores.runs.mudarStatusSe(contaId, runId, "waiting_for_input", "running")
      if (!trocou) throw new RunNaoContinuavelError()
    }
    const run = await stores.runs.buscar(contaId, runId)
    if (run?.status !== "running") throw new RunNaoContinuavelError()
    const lido = lerEstado(run, p.agente)
    if (typeof lido === "string") {
      const falho = await falhar(contaId, runId, lido)
      return { run: falho, fim: { tipo: "erro", codigo: lido } }
    }
    const { estado, pendencia } = lido
    return protegido(contaId, run, p, () => {
      const retomado = retomarCheckpoint(
        estado,
        pendencia,
        resultadoDaTool(p, estado, pendencia, p.resposta),
      )
      return trecho(contaId, run, retomado, p)
    })
  }

  async function pausarSemAgente(
    contaId: string,
    runId: string,
    pendencia: Omit<Pendencia, "criada_em" | "chamada_id">,
  ): Promise<Run> {
    const run = await buscarOuFalhar(contaId, runId)
    await mudarStatus(stores, contaId, run, "waiting_for_input", {
      pendencia: { ...pendencia, criada_em: clock.now().toISOString() },
      checkpoint: null,
    })
    telemetry.evento("pausa", { "pausa.tipo": pendencia.tipo })
    telemetry.contador("ritu_pausas_total", { tipo: pendencia.tipo })
    return buscarOuFalhar(contaId, runId)
  }

  return {
    iniciarRun,
    executarRun,
    continuarRun,
    pausarSemAgente,
    gravarEtapa,
    encerrar,
    comSpanDoRun,
  }
}
