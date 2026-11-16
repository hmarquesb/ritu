import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import type { ModelRouter } from "@/core/llm/router"
import type { DefinicaoDoAgente } from "@/core/runs/agente"
import { lerCheckpoint } from "@/core/runs/checkpoint"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import { type EventoAoVivo, novoCheckpoint } from "@/core/runs/loop"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Run, RunEtapa } from "@/core/runs/ports"
import type { createRunService } from "@/core/runs/run-service"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { ToolContext } from "@/core/tools/tool"
import type { CidadeDaPessoa, WeatherSource } from "@/core/weather/ports"
import { criarAcompanhante } from "./agente"
import { montarMensagemInicial } from "./contexto"
import { contextoDoRun } from "./contexto-do-run"
import { type EntradaDoAcompanhante, entradaDoAcompanhanteSchema } from "./entrada"
import {
  campos,
  criarFimDoRun,
  type Perfil,
  type RespostaDoRun,
  saidaSemModeloDe,
} from "./fim-do-run"
import { aplicarResposta, candidatosRetirados } from "./pergunta-do-run"
import { type DadosDoPreparo, dadosDoPreparoSchema, preparar } from "./preparo"

export type { RespostaDoRun } from "./fim-do-run"

type Deps = {
  stores: Stores
  kb: KnowledgeBase
  clock: Clock
  weather: WeatherSource
  router: ModelRouter
  runs: ReturnType<typeof createRunService>
  telemetry: Telemetry
}

type OpcoesDoResponder = {
  aoVivo?: (e: EventoAoVivo) => void
  run?: Run
  semModelo?: boolean
  perguntasFeitas?: number
}
type ClimaUsado = Record<string, unknown>

function modelosDoRun(run: Run | undefined): Record<string, string[]> {
  const m = run?.modelos
  return m && typeof m === "object" ? (m as Record<string, string[]>) : {}
}

function cidadeDoPerfil(perfil: Perfil): CidadeDaPessoa | undefined {
  if (
    perfil.cidade_nome === null ||
    perfil.cidade_lat === null ||
    perfil.cidade_lon === null ||
    perfil.cidade_fuso === null
  ) {
    return undefined
  }
  return {
    nome: perfil.cidade_nome,
    lat: perfil.cidade_lat,
    lon: perfil.cidade_lon,
    fuso: perfil.cidade_fuso,
  }
}

async function sinaisDaPessoa(
  stores: Stores,
  contaId: string,
  dados: DadosDoPreparo,
): Promise<SinaisPessoa> {
  const preferencias = await stores.preferences.ler(contaId)
  const ajudou: Record<string, number> = {}
  for (const p of preferencias) if (p.ajudou > 0) ajudou[p.item_id] = p.ajudou
  return {
    em_casa: dados.casa.confirmados,
    gosta: preferencias.filter((p) => p.gosto === "gosta").map((p) => p.item_id),
    ajudou,
  }
}

// Guarda o resultado ok de clima.agora, sem o nome da cidade, para gravar no run.
function acompanharClima(
  agente: DefinicaoDoAgente,
  guardar: (c: ClimaUsado) => void,
): DefinicaoDoAgente {
  return {
    ...agente,
    tools: agente.tools.map((tool) => {
      if (tool.name !== "clima.agora") return tool
      return {
        ...tool,
        async execute(entrada, ctx) {
          const saida = await tool.execute(entrada, ctx)
          const { cidade: _cidade, ...resto } = saida as ClimaUsado
          if (resto.status === "ok") guardar(resto)
          return saida
        },
      }
    }),
  }
}

export function createCompanion(deps: Deps) {
  const { stores, kb, clock, telemetry, runs, router } = deps
  const fimDoRun = criarFimDoRun({ stores, kb, runs, telemetry })

  async function semModelo(
    contaId: string,
    intencoes: EntradaDoAcompanhante["intencoes"],
    dados: DadosDoPreparo,
    perfil: Perfil,
    fuso: string | undefined,
    dado?: Run,
  ): Promise<RespostaDoRun> {
    const run =
      dado ??
      (await runs.iniciarRun(contaId, {
        caminho: "sem_modelo",
        intencoes,
        fuso,
      }))
    const saida = saidaSemModeloDe(kb, dados, perfil)
    telemetry.contador("ritu_fallback_sem_llm_total")
    await runs.encerrar(
      contaId,
      run.id,
      "done",
      campos(dados, {
        saida,
        modelos: { ...modelosDoRun(dado), decisao: [] },
        trocas_de_modelo: dado?.trocas_de_modelo ?? 0,
        ...(dado ? { caminho: "sem_modelo" as const } : {}),
      }),
    )
    return { run_id: run.id, status: "done", saida, fim: "sem_modelo" }
  }

  async function abrirRun(
    contaId: string,
    entrada: EntradaDoAcompanhante,
    fuso: string | undefined,
    dado?: Run,
  ): Promise<Run> {
    if (dado) return dado
    const run = await runs.iniciarRun(contaId, {
      caminho: "acompanhante",
      intencoes: entrada.intencoes,
      fuso,
    })
    for (const intencao of entrada.intencoes) {
      telemetry.contador("ritu_run_intencao_total", { intencao })
    }
    return run
  }

  async function montarCtx(
    contaId: string,
    casaDaMensagem: ToolContext["casaDaMensagem"],
    dados: DadosDoPreparo,
    perfil: Perfil,
  ): Promise<ToolContext> {
    const cidade = cidadeDoPerfil(perfil)
    return {
      kb,
      filtro: dados.filtro,
      sinais: await sinaisDaPessoa(stores, contaId, dados),
      prakriti: perfil.prakriti ?? undefined,
      clima: { fonte: deps.weather, ...(cidade ? { cidade } : {}) },
      contaId,
      stores,
      clock,
      fuso: perfil.cidade_fuso ?? undefined,
      telemetry,
      ...(casaDaMensagem ? { casaDaMensagem } : {}),
      run: contextoDoRun(dados),
    }
  }

  async function comModelo(
    contaId: string,
    entrada: EntradaDoAcompanhante,
    dados: DadosDoPreparo,
    perfil: Perfil,
    opts?: OpcoesDoResponder,
  ): Promise<RespostaDoRun> {
    const fuso = perfil.cidade_fuso ?? undefined
    const run = await abrirRun(contaId, entrada, fuso, opts?.run)
    const ctx = await montarCtx(contaId, entrada.casa_da_mensagem, dados, perfil)
    let climaUsado: ClimaUsado | undefined
    const modelos: string[] = []
    let trocas = 0
    const agente = acompanharClima(criarAcompanhante(), (c) => {
      climaUsado = c
    })
    const resultado = await runs.executarRun(contaId, run.id, {
      agente,
      ctx,
      estado: novoCheckpoint(agente, montarMensagemInicial(dados, entrada.texto), dados),
      modelo: router.paraPapel("decisao", {
        aoTrocar: () => {
          trocas += 1
        },
      }),
      aoVivo: opts?.aoVivo,
      aoGravarEtapa(e: RunEtapa) {
        if (e.tipo === "llm" && e.modelo && !modelos.includes(e.modelo)) modelos.push(e.modelo)
      },
    })
    return fimDoRun.tratar(contaId, resultado, dados, perfil, {
      clima_usado: climaUsado ?? null,
      prompt_versao: agente.prompt_versao,
      modelos: { decisao: modelos },
      trocas_de_modelo: trocas,
    })
  }

  async function responder(
    contaId: string,
    entradaBruta: EntradaDoAcompanhante,
    opts?: OpcoesDoResponder,
  ): Promise<RespostaDoRun> {
    const entrada = entradaDoAcompanhanteSchema.parse(entradaBruta)
    const dados = await preparar(
      { stores, kb, clock, telemetry },
      contaId,
      entrada,
      opts?.run || opts?.perguntasFeitas !== undefined
        ? { runId: opts?.run?.id, perguntasFeitas: opts?.perguntasFeitas }
        : undefined,
    )
    const perfil = await stores.profiles.ler(contaId)
    if (opts?.semModelo || !(await router.temModelo("decisao"))) {
      return semModelo(
        contaId,
        entrada.intencoes,
        dados,
        perfil,
        perfil.cidade_fuso ?? undefined,
        opts?.run,
      )
    }
    return comModelo(contaId, entrada, dados, perfil, opts)
  }

  async function continuar(
    contaId: string,
    run: Run,
    r: { pergunta: Pergunta; resposta: RespostaDaPessoa },
    opts?: { aoVivo?: (e: EventoAoVivo) => void },
  ): Promise<RespostaDoRun> {
    if (run.status !== "running") throw new RunNaoContinuavelError()
    const cp = lerCheckpoint(run.checkpoint)
    const dados = dadosDoPreparoSchema.parse(cp.dados)
    const novos = aplicarResposta(dados, r.pergunta, r.resposta, kb)
    const retirados = candidatosRetirados(dados, novos)
    await stores.runs.atualizar(contaId, run.id, { checkpoint: { ...cp, dados: novos } })
    const perfil = await stores.profiles.ler(contaId)
    if (!(await router.temModelo("decisao"))) {
      return semModelo(
        contaId,
        run.intencoes as EntradaDoAcompanhante["intencoes"],
        novos,
        perfil,
        undefined,
        run,
      )
    }
    const ctx = await montarCtx(contaId, { tem: novos.casa.confirmados, acabou: [] }, novos, perfil)
    let climaUsado: ClimaUsado | undefined
    const modelos: string[] = []
    let trocas = 0
    const agente = acompanharClima(criarAcompanhante(), (c) => {
      climaUsado = c
    })
    const resultado = await runs.continuarRun(contaId, run.id, {
      agente,
      ctx,
      modelo: router.paraPapel("decisao", {
        aoTrocar: () => {
          trocas += 1
        },
      }),
      aoVivo: opts?.aoVivo,
      aoGravarEtapa(e: RunEtapa) {
        if (e.tipo === "llm" && e.modelo && !modelos.includes(e.modelo)) modelos.push(e.modelo)
      },
      resposta: { pergunta: r.pergunta, resposta: r.resposta, candidatos_retirados: retirados },
      reservado: true,
    })
    const anteriores = modelosDoRun(run)
    const decisao = [...new Set([...(anteriores.decisao ?? []), ...modelos])]
    return fimDoRun.tratar(contaId, resultado, novos, perfil, {
      clima_usado: climaUsado ?? run.clima_usado ?? null,
      prompt_versao: agente.prompt_versao,
      modelos: { ...anteriores, decisao },
      trocas_de_modelo: run.trocas_de_modelo + trocas,
    })
  }

  return { responder, continuar }
}
