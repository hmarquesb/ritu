import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { respostaSemModelo } from "@/core/llm/sem-modelo"
import type { FimDoTrecho } from "@/core/runs/loop"
import type { Pergunta } from "@/core/runs/pergunta"
import type { Run, RunMutavel } from "@/core/runs/ports"
import type { createRunService, ResultadoDoRun } from "@/core/runs/run-service"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import { conteudoDaPendenciaSchema } from "./pergunta-do-run"
import type { DadosDoPreparo } from "./preparo"
import { registrarEntrega } from "./registrar-entrega"
import {
  type SaidaDoAcompanhante,
  saidaDoAcompanhanteSchema,
  saidaSegura,
  saidaSemModelo,
} from "./saida"

export type RespostaDoRun = {
  run_id: string
  status: Run["status"]
  saida?: SaidaDoAcompanhante
  pergunta?: Pergunta
  fim: FimDoTrecho["tipo"]
  motivo?: string
}

export type Perfil = Awaited<ReturnType<Stores["profiles"]["ler"]>>

type DepsDoFim = {
  stores: Stores
  tx: Transactor
  kb: KnowledgeBase
  runs: ReturnType<typeof createRunService>
  telemetry: Telemetry
}

export function campos(dados: DadosDoPreparo, extra: Partial<RunMutavel>): Partial<RunMutavel> {
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

export function saidaSemModeloDe(
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

type Desfecho = {
  saida: SaidaDoAcompanhante
  alvo: "done" | "failed"
  erro?: string
  motivo?: string
}

// Trata o fim de um trecho do loop (de `responder` e de `continuar`): grava, encerra e responde.
export function criarFimDoRun(deps: DepsDoFim) {
  const { stores, tx, kb, runs, telemetry } = deps

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
    manterAberto?: boolean,
  ): Promise<Run["status"]> {
    if (run.status === "running" && manterAberto && alvo === "done") {
      await stores.runs.atualizar(contaId, run.id, c)
      return "running"
    }
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

  // Só a saída segura loga resposta_segura; a montada por código (sem_modelo) não é segura.
  function segura(dados: DadosDoPreparo, motivo: string): Desfecho["saida"] {
    telemetry.log("resposta_segura", { motivo })
    return saidaSegura(dados)
  }

  function desfecho(fim: FimDoTrecho, dados: DadosDoPreparo, perfil: Perfil): Desfecho {
    if (fim.tipo === "entregue") {
      const saida = saidaDoAgente(fim.saida)
      if (saida) return { saida, alvo: "done" }
      return { saida: segura(dados, "saida_invalida"), alvo: "failed", erro: "saida_invalida" }
    }
    if (fim.tipo === "limite") {
      return {
        saida: segura(dados, `limite:${fim.motivo}`),
        alvo: "done",
        erro: `limite:${fim.motivo}`,
        motivo: fim.motivo,
      }
    }
    if (fim.tipo === "sem_modelo") {
      return { saida: saidaSemModeloDe(kb, dados, perfil), alvo: "done" }
    }
    const codigo = fim.tipo === "erro" ? fim.codigo : "pausa_inesperada"
    return { saida: segura(dados, codigo), alvo: "failed", erro: codigo, motivo: codigo }
  }

  // Grava retornos, "já sugerido" e faltas. Se falhar, o run segue com a saída como veio e a etapa de erro.
  async function entregar(
    contaId: string,
    runId: string,
    saida: SaidaDoAcompanhante,
    dados: DadosDoPreparo,
  ): Promise<SaidaDoAcompanhante> {
    try {
      return await registrarEntrega(
        { tx, telemetry },
        { contaId, runId, dia: dados.dia, saida, dados },
      )
    } catch {
      await registrarErro(contaId, runId, "registro_da_entrega")
      return saida
    }
  }

  function medirParaTer(dados: DadosDoPreparo, saida: SaidaDoAcompanhante): void {
    if (!dados.para_ter) return
    telemetry.contador("ritu_para_ter_total", { etapa: "candidato" })
    if (saida.para_ter) telemetry.contador("ritu_para_ter_total", { etapa: "indicada" })
  }

  async function pausa(
    contaId: string,
    resultado: ResultadoDoRun,
    dados: DadosDoPreparo,
    extra: Partial<RunMutavel>,
  ): Promise<RespostaDoRun> {
    const { run, fim } = resultado
    const conteudo = fim.tipo === "pausa" ? fim.pendencia.conteudo : undefined
    const lido = conteudoDaPendenciaSchema.safeParse(conteudo)
    if (!lido.success) {
      await stores.runs.mudarStatusSe(contaId, run.id, "waiting_for_input", "running")
      await registrarErro(contaId, run.id, "pausa_invalida")
      const saida = segura(dados, "pausa_invalida")
      await runs.encerrar(contaId, run.id, "failed", campos(dados, { ...extra, saida }))
      return { run_id: run.id, status: "failed", saida, fim: "erro", motivo: "pausa_invalida" }
    }
    await stores.runs.atualizar(contaId, run.id, campos(dados, extra))
    return {
      run_id: run.id,
      status: "waiting_for_input",
      fim: "pausa",
      pergunta: lido.data.pergunta,
    }
  }

  async function tratar(
    contaId: string,
    resultado: ResultadoDoRun,
    dados: DadosDoPreparo,
    perfil: Perfil,
    extra: Partial<RunMutavel>,
    manterAberto?: boolean,
  ): Promise<RespostaDoRun> {
    if (resultado.fim.tipo === "pausa") return pausa(contaId, resultado, dados, extra)
    const decidido = desfecho(resultado.fim, dados, perfil)
    const { alvo, erro, motivo } = decidido
    let { saida } = decidido
    if (erro) await registrarErro(contaId, resultado.run.id, erro)
    if (alvo === "done") saida = await entregar(contaId, resultado.run.id, saida, dados)
    const status = await fechar(
      contaId,
      resultado.run,
      alvo,
      campos(dados, { ...extra, saida }),
      manterAberto,
    )
    if (resultado.fim.tipo === "sem_modelo") telemetry.contador("ritu_fallback_sem_llm_total")
    medirParaTer(dados, saida)
    return {
      run_id: resultado.run.id,
      status,
      saida,
      fim: resultado.fim.tipo,
      ...(motivo ? { motivo } : {}),
    }
  }

  return { tratar, entregar }
}
