import { config } from "@config/index"
import { acrescentarNaoCome } from "@/core/agents/companion/anotacoes"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import {
  type ConteudoDaPendencia,
  conteudoDaPendenciaSchema,
} from "@/core/agents/companion/pergunta-do-run"
import { type SaidaDoAcompanhante, saidaSegura } from "@/core/agents/companion/saida"
import { RituError } from "@/core/errors"
import { pendenciaSchema } from "@/core/runs/checkpoint"
import { RunNaoContinuavelError } from "@/core/runs/errors"
import { gravarResposta } from "@/core/runs/gravar-resposta"
import type { EventoAoVivo } from "@/core/runs/loop"
import {
  type Pergunta,
  type RespostaDaPessoa,
  respostaDaPessoaSchema,
  textoDaResposta,
  validarResposta,
} from "@/core/runs/pergunta"
import type { Run } from "@/core/runs/ports"
import { comAvisoDeIncomodo } from "./aviso-de-incomodo"
import type { Deps, RespostaDaConversa } from "./conversar"
import { fecharOuFalhar, filtroDoRun } from "./fim-com-propostas"
import { anotarPendencia } from "./pausa-de-codigo"

type AoVivo = (e: EventoAoVivo) => void
type Opcoes = { aoVivo?: AoVivo }
type Parte = { saida?: SaidaDoAcompanhante; pergunta?: Pergunta }
type Retomada = { contaId: string; run: Run; conteudo: ConteudoDaPendencia; aoVivo?: AoVivo }

const MS_POR_MINUTO = 60_000

function naoContinuavel(): RunNaoContinuavelError {
  return new RunNaoContinuavelError()
}

function naoComeDoCheckpoint(run: Run | undefined): string[] {
  const dados = (run?.checkpoint as { dados?: { nao_come_do_run?: unknown } } | null)?.dados
  const lista = dados?.nao_come_do_run
  return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : []
}

export function criarContinuar(deps: Deps) {
  const { stores, tx, kb, clock, telemetry, runs, companion } = deps

  async function lerPendente(contaId: string, runId: string) {
    const run = await stores.runs.buscar(contaId, runId)
    if (run?.status !== "waiting_for_input") throw naoContinuavel()
    const pendencia = pendenciaSchema.safeParse(run.pendencia)
    if (!pendencia.success) throw naoContinuavel()
    const conteudo = conteudoDaPendenciaSchema.safeParse(pendencia.data.conteudo)
    if (!conteudo.success) throw naoContinuavel()
    return { run, conteudo: conteudo.data, criadaEm: pendencia.data.criada_em }
  }

  async function conferirPrazo(contaId: string, run: Run, criadaEm: string): Promise<void> {
    const espera = clock.now().getTime() - new Date(criadaEm).getTime()
    if (espera <= config.memoria.esperaMinutos * MS_POR_MINUTO) return
    const trocou = await stores.runs.mudarStatusSe(contaId, run.id, "waiting_for_input", "expired")
    if (!trocou) throw naoContinuavel()
    throw new RituError("pergunta_expirada", "A pergunta expirou")
  }

  async function gravarMensagemDoAgente(
    contaId: string,
    run: Run,
    texto: string,
    comIncomodo: boolean,
  ) {
    await stores.messages.gravar(contaId, {
      run_id: run.id,
      autor: "agente",
      texto,
      com_incomodo: comIncomodo,
      dia: run.dia,
    })
  }

  async function gravarDaPessoa(x: Retomada, resposta: RespostaDaPessoa): Promise<void> {
    const { contaId, run, conteudo } = x
    try {
      await gravarResposta({ tx, telemetry }, contaId, run.id, run.dia, conteudo.pergunta, resposta)
      await stores.messages.gravar(contaId, {
        run_id: run.id,
        autor: "pessoa",
        texto: textoDaResposta(conteudo.pergunta, resposta),
        com_incomodo: conteudo.pergunta.tipo === "variante",
        dia: run.dia,
      })
    } catch (e) {
      await stores.runs.mudarStatusSe(contaId, run.id, "running", "waiting_for_input")
      throw e
    }
  }

  async function retomar(x: Retomada, resposta: RespostaDaPessoa, runAtual: Run) {
    const { contaId, conteudo, aoVivo } = x
    if (conteudo.origem === "agente") {
      return companion.continuar(
        contaId,
        runAtual,
        { pergunta: conteudo.pergunta, resposta },
        { aoVivo, manterAberto: true },
      )
    }
    const { entrada } = conteudo
    const nova: EntradaDoAcompanhante =
      resposta.tipo === "variante" && entrada.incomodo
        ? { ...entrada, incomodo: { ...entrada.incomodo, variante: resposta.variante } }
        : entrada
    return companion.responder(contaId, nova, {
      run: runAtual,
      perguntasFeitas: 1,
      manterAberto: true,
      aoVivo,
    })
  }

  // Total determinístico: tokens de todas as etapas do run (loop, Intérprete e Juiz, cada uma uma vez).
  async function fixarTotais(contaId: string, runId: string): Promise<void> {
    const atual = await stores.runs.buscar(contaId, runId)
    const etapas = await stores.runs.etapas(contaId, runId)
    if (!atual) return
    const modelos = typeof atual.modelos === "object" && atual.modelos !== null ? atual.modelos : {}
    const anteriores = (modelos as { apoio?: string[] }).apoio ?? []
    const doApoio = etapas
      .filter((e) => (e.tipo === "interprete" || e.tipo === "juiz") && e.modelo)
      .map((e) => e.modelo as string)
    const apoio = [...new Set([...anteriores, ...doApoio])]
    await stores.runs.atualizar(contaId, runId, {
      modelos: { ...modelos, ...(apoio.length > 0 ? { apoio } : {}) },
      tokens_entrada: etapas.reduce((t, e) => t + e.tokens_entrada, 0),
      tokens_saida: etapas.reduce((t, e) => t + e.tokens_saida, 0),
    })
  }

  async function aposOutraPausa(x: Retomada, pergunta: Pergunta, run: Run): Promise<Parte> {
    const { contaId, conteudo } = x
    await anotarPendencia(stores, contaId, run.id, conteudo.anotacoes ?? [])
    const atual = await stores.runs.buscar(contaId, run.id)
    await gravarMensagemDoAgente(contaId, run, pergunta.texto, Boolean(atual?.com_incomodo))
    return { pergunta }
  }

  // `incomodoAntes`: a marca do run antes da retomada, que a nova rodada do agente pode zerar.
  async function aposFim(
    x: Retomada,
    saida: SaidaDoAcompanhante,
    incomodoAntes: boolean,
  ): Promise<Parte> {
    const { contaId, run, conteudo } = x
    const atual = await stores.runs.buscar(contaId, run.id)
    const perfil = await stores.profiles.ler(contaId)
    const anotacoes = acrescentarNaoCome(
      conteudo.anotacoes ?? [],
      naoComeDoCheckpoint(atual),
      perfil,
      kb,
    )
    const incomodo = incomodoAntes || Boolean(atual?.com_incomodo)
    const final = { ...comAvisoDeIncomodo(saida, incomodo), anotacoes }
    await stores.runs.atualizar(contaId, run.id, { saida: final })
    await fixarTotais(contaId, run.id)
    await gravarMensagemDoAgente(contaId, run, final.resposta, false)
    if (incomodo) await stores.messages.marcarIncomodoDoRun(contaId, run.id)
    if (atual?.status !== "running") return { saida: final }
    const fechada = await fecharOuFalhar(
      { stores, kb, runs, telemetry, clock },
      {
        contaId,
        runId: run.id,
        caminho: atual.caminho,
        comIncomodo: incomodo,
        saida: final,
        anotacoes,
        filtro: filtroDoRun(atual),
        aoVivo: x.aoVivo,
      },
    )
    return { saida: fechada }
  }

  async function seguir(x: Retomada, resposta: RespostaDaPessoa): Promise<Parte> {
    const { contaId, run } = x
    const runAtual = await stores.runs.buscar(contaId, run.id)
    if (!runAtual) throw naoContinuavel()
    const r = await retomar(x, resposta, runAtual)
    if (r.pergunta) return aposOutraPausa(x, r.pergunta, run)
    if (!r.saida) throw new RituError("run_pausado", "O run pausou sem saída")
    return aposFim(x, r.saida, runAtual.com_incomodo)
  }

  async function falhar(x: Retomada): Promise<Parte> {
    const { contaId, run } = x
    telemetry.log("resposta_segura", { motivo: "erro_na_retomada" })
    const saida = saidaSegura()
    const atual = await stores.runs.buscar(contaId, run.id)
    if (atual?.status === "running") await runs.encerrar(contaId, run.id, "failed", { saida })
    await gravarMensagemDoAgente(contaId, run, saida.resposta, false)
    return { saida }
  }

  async function dentroDoSpan(x: Retomada, resposta: RespostaDaPessoa): Promise<Parte> {
    await gravarDaPessoa(x, resposta)
    try {
      return await seguir(x, resposta)
    } catch (e) {
      if (e instanceof RunNaoContinuavelError) throw e
      return falhar(x)
    }
  }

  return async function continuar(
    contaId: string,
    runId: string,
    entrada: RespostaDaPessoa,
    opts?: Opcoes,
  ): Promise<RespostaDaConversa> {
    const { run, conteudo, criadaEm } = await lerPendente(contaId, runId)
    await conferirPrazo(contaId, run, criadaEm)
    const lida = respostaDaPessoaSchema.safeParse(entrada)
    if (!lida.success || !validarResposta(conteudo.pergunta, lida.data)) {
      throw new RituError("resposta_invalida", "Resposta inválida")
    }
    const trocou = await stores.runs.mudarStatusSe(contaId, runId, "waiting_for_input", "running")
    if (!trocou) throw naoContinuavel()
    const x: Retomada = { contaId, run, conteudo, aoVivo: opts?.aoVivo }
    const parte = await runs.comSpanDoRun(contaId, runId, () => dentroDoSpan(x, lida.data))
    const final = await stores.runs.buscar(contaId, runId)
    return {
      run_id: runId,
      status: final?.status ?? run.status,
      caminho: final?.caminho ?? run.caminho,
      ...(parte.saida ? { saida: parte.saida } : {}),
      ...(parte.pergunta ? { pergunta: parte.pergunta } : {}),
    }
  }
}
