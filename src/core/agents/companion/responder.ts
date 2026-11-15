import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import type { ModelRouter } from "@/core/llm/router"
import { respostaSemModelo } from "@/core/llm/sem-modelo"
import type { DefinicaoDoAgente } from "@/core/runs/agente"
import { type EventoAoVivo, type FimDoTrecho, novoCheckpoint } from "@/core/runs/loop"
import type { Run, RunEtapa, RunMutavel } from "@/core/runs/ports"
import type { createRunService } from "@/core/runs/run-service"
import type { Stores } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { ToolContext } from "@/core/tools/tool"
import type { CidadeDaPessoa, WeatherSource } from "@/core/weather/ports"
import { criarAcompanhante } from "./agente"
import { montarMensagemInicial } from "./contexto"
import { type EntradaDoAcompanhante, entradaDoAcompanhanteSchema } from "./entrada"
import { type DadosDoPreparo, preparar } from "./preparo"
import {
  type SaidaDoAcompanhante,
  saidaDoAcompanhanteSchema,
  saidaSegura,
  saidaSemModelo,
} from "./saida"

export type RespostaDoRun = {
  run_id: string
  status: Run["status"]
  saida: SaidaDoAcompanhante
  fim: FimDoTrecho["tipo"]
  motivo?: string
}

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
}

type Perfil = Awaited<ReturnType<Stores["profiles"]["ler"]>>
type ClimaUsado = Record<string, unknown>

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

function campos(
  dados: DadosDoPreparo,
  extra: Partial<RunMutavel> & { saida: SaidaDoAcompanhante },
): Partial<RunMutavel> {
  return {
    momento: {
      estados: dados.estados,
      momento_do_dia: dados.momento_do_dia,
      gunas_buscadas: dados.qualidades.buscadas,
    },
    com_incomodo: dados.com_incomodo,
    ...extra,
  }
}

function erroDe(nome: string) {
  return {
    tipo: "erro" as const,
    nome,
    status: "falhou" as const,
    duracao_ms: 0,
    resumo: null,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  }
}

function saidaSemModeloDe(
  kb: KnowledgeBase,
  dados: DadosDoPreparo,
  perfil: Perfil,
): SaidaDoAcompanhante {
  const resposta = respostaSemModelo(
    {
      estados: dados.estados,
      momento_do_dia: dados.momento_do_dia,
      filtro: dados.filtro,
      prakriti: perfil.prakriti ?? undefined,
    },
    kb,
  )
  return saidaSemModelo(resposta, dados, kb)
}

function saidaDoAgente(saida: unknown): SaidaDoAcompanhante | undefined {
  const lida = saidaDoAcompanhanteSchema.safeParse(saida)
  return lida.success ? (lida.data as SaidaDoAcompanhante) : undefined
}

export function createCompanion(deps: Deps) {
  const { stores, kb, clock, telemetry, runs, router } = deps

  async function semModelo(
    contaId: string,
    entrada: EntradaDoAcompanhante,
    dados: DadosDoPreparo,
    perfil: Perfil,
    fuso: string | undefined,
    dado?: Run,
  ): Promise<RespostaDoRun> {
    const run =
      dado ??
      (await runs.iniciarRun(contaId, {
        caminho: "sem_modelo",
        intencoes: entrada.intencoes,
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
        modelos: { decisao: [] },
        trocas_de_modelo: 0,
        ...(dado ? { caminho: "sem_modelo" as const } : {}),
      }),
    )
    return { run_id: run.id, status: "done", saida, fim: "sem_modelo" }
  }

  async function registrarErro(contaId: string, runId: string, nome: string): Promise<void> {
    const etapas = await stores.runs.etapas(contaId, runId)
    if (etapas.some((e) => e.tipo === "erro" && e.nome === nome)) return
    await runs.gravarEtapa(contaId, runId, erroDe(nome))
  }

  // O run pode já ter sido encerrado pelo serviço; só grava os campos quando é o caso.
  async function fechar(
    contaId: string,
    run: Run,
    alvo: "done" | "failed",
    c: Partial<RunMutavel>,
  ): Promise<Run["status"]> {
    if (run.status === "running") {
      await runs.encerrar(contaId, run.id, alvo, c)
      return alvo
    }
    if (run.status === "waiting_for_input") {
      await runs.encerrar(contaId, run.id, "cancelled", c)
      return "cancelled"
    }
    await stores.runs.atualizar(contaId, run.id, c)
    return run.status
  }

  function saidaDoFim(
    fim: FimDoTrecho,
    dados: DadosDoPreparo,
    perfil: Perfil,
  ): { saida: SaidaDoAcompanhante; alvo: "done" | "failed"; erro?: string; motivo?: string } {
    if (fim.tipo === "entregue") {
      const saida = saidaDoAgente(fim.saida)
      if (saida) return { saida, alvo: "done" }
      return { saida: saidaSegura(dados), alvo: "failed", erro: "saida_invalida" }
    }
    if (fim.tipo === "limite") {
      return {
        saida: saidaSegura(dados),
        alvo: "done",
        erro: `limite:${fim.motivo}`,
        motivo: fim.motivo,
      }
    }
    if (fim.tipo === "sem_modelo") {
      return { saida: saidaSemModeloDe(kb, dados, perfil), alvo: "done" }
    }
    const codigo = fim.tipo === "erro" ? fim.codigo : "pausa_inesperada"
    return { saida: saidaSegura(dados), alvo: "failed", erro: codigo, motivo: codigo }
  }

  function medirParaTer(dados: DadosDoPreparo, saida: SaidaDoAcompanhante): void {
    if (!dados.para_ter) return
    telemetry.contador("ritu_para_ter_total", { etapa: "candidato" })
    if (saida.para_ter) telemetry.contador("ritu_para_ter_total", { etapa: "indicada" })
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
    entrada: EntradaDoAcompanhante,
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
      ...(entrada.casa_da_mensagem ? { casaDaMensagem: entrada.casa_da_mensagem } : {}),
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
    const ctx = await montarCtx(contaId, entrada, dados, perfil)
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
    const { saida, alvo, erro, motivo } = saidaDoFim(resultado.fim, dados, perfil)
    if (erro) await registrarErro(contaId, run.id, erro)
    const status = await fechar(
      contaId,
      resultado.run,
      alvo,
      campos(dados, {
        saida,
        clima_usado: climaUsado ?? null,
        prompt_versao: agente.prompt_versao,
        modelos: { decisao: modelos },
        trocas_de_modelo: trocas,
      }),
    )
    if (resultado.fim.tipo === "sem_modelo") telemetry.contador("ritu_fallback_sem_llm_total")
    medirParaTer(dados, saida)
    return {
      run_id: run.id,
      status,
      saida,
      fim: resultado.fim.tipo,
      ...(motivo ? { motivo } : {}),
    }
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
      opts?.run ? { runId: opts.run.id } : undefined,
    )
    const perfil = await stores.profiles.ler(contaId)
    if (opts?.semModelo || !(await router.temModelo("decisao"))) {
      return semModelo(contaId, entrada, dados, perfil, perfil.cidade_fuso ?? undefined, opts?.run)
    }
    return comModelo(contaId, entrada, dados, perfil, opts)
  }

  return { responder }
}
