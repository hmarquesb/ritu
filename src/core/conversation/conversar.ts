import { config } from "@config/index"
import type { Perfil } from "@/core/accounts/types"
import { type EntradaDoAcompanhante, intencaoSchema } from "@/core/agents/companion/entrada"
import type { createCompanion } from "@/core/agents/companion/responder"
import { type SaidaDoAcompanhante, saidaDeCodigo, saidaSegura } from "@/core/agents/companion/saida"
import {
  type Interpretacao,
  interpretacaoDosAtalhos,
} from "@/core/agents/interpreter/interpretacao"
import type { createInterpreter } from "@/core/agents/interpreter/interpretar"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { ESTADOS } from "@/core/knowledge/vocab"
import { lerConversaDoDia } from "@/core/messages/para-o-prompt"
import { type MensagemRecebida, textoDaMensagem } from "@/core/messages/texto"
import { escolherCaminho } from "@/core/runs/caminhos"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Caminho, NovaEtapa, Run, RunEtapa } from "@/core/runs/ports"
import type { createRunService } from "@/core/runs/run-service"
import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import {
  anotacoesDaMensagem,
  type CaminhoDeCodigo,
  type ContextoDoCaminho,
  ehCaminhoDeCodigo,
  gravarItensDoDia,
  registrarRetornoDaConversa,
  resolverCaminhoDeCodigo,
} from "./caminhos-de-codigo"

export { type MensagemRecebida, mensagemRecebidaSchema } from "@/core/messages/texto"

export type RespostaDaConversa = {
  run_id: string
  status: Run["status"]
  caminho: Caminho
  saida: SaidaDoAcompanhante
  interpretacao?: Interpretacao
}

type Deps = {
  stores: Stores
  tx: Transactor
  kb: KnowledgeBase
  clock: Clock
  telemetry: Telemetry
  runs: ReturnType<typeof createRunService>
  interpreter: ReturnType<typeof createInterpreter>
  companion: ReturnType<typeof createCompanion>
}

type AoVivo = (e: EventoAoVivo) => void
type Apoio = { modelo: string; tokens: { entrada: number; saida: number }; duracao_ms: number }
type Interpretado = { interpretacao?: Interpretacao; apoio?: Apoio }
type Resultado = { saida: SaidaDoAcompanhante; incomodo: boolean }
type Execucao = {
  contaId: string
  run: Run
  perfil: Perfil
  m: MensagemRecebida
  aoVivo?: AoVivo
}

function mensagemInvalida(): RituError {
  return new RituError("mensagem_invalida", "Mensagem inválida")
}

// Texto só com espaços conta como ausente; o texto guardado já vai sem as bordas.
function validar(m: MensagemRecebida): MensagemRecebida {
  const texto = m.texto?.trim()
  const atalhosOk = m.atalhos.every((a) => (ESTADOS as readonly string[]).includes(a))
  const vazia = !texto && m.atalhos.length === 0
  const longa = texto !== undefined && Array.from(texto).length > config.conversa.maxCaracteres
  if (!atalhosOk || vazia || longa) throw mensagemInvalida()
  return texto ? { texto, atalhos: m.atalhos } : { atalhos: m.atalhos }
}

function intencoesDoAcompanhante(
  intencoes: string[],
  i: Interpretacao,
): EntradaDoAcompanhante["intencoes"] {
  const validas = intencoes.flatMap((x) => {
    const lida = intencaoSchema.safeParse(x)
    return lida.success ? [lida.data] : []
  })
  if (validas.length > 0) return validas
  return i.estados.length > 0 || i.incomodo ? ["momento"] : ["vida"]
}

function casaDaMensagem(i: Interpretacao): EntradaDoAcompanhante["casa_da_mensagem"] {
  const idsDe = (acao: "tem" | "acabou") =>
    i.itens_casa.flatMap((c) => (c.acao === acao && c.alimento_id ? [c.alimento_id] : []))
  const tem = idsDe("tem")
  const acabou = idsDe("acabou")
  return tem.length + acabou.length > 0 ? { tem, acabou } : undefined
}

function entradaDoAcompanhante(
  texto: string | undefined,
  i: Interpretacao,
  intencoes: string[],
): EntradaDoAcompanhante {
  const casa = casaDaMensagem(i)
  const { retorno } = i
  return {
    intencoes: intencoesDoAcompanhante(intencoes, i),
    estados: i.estados,
    evitar_da_mensagem: i.evitar.filter((item) => item.tipo === "texto").map((item) => item.valor),
    ...(texto ? { texto } : {}),
    ...(i.incomodo ? { incomodo: i.incomodo } : {}),
    ...(i.nao_come.length > 0 ? { nao_come_da_mensagem: i.nao_come } : {}),
    ...(i.restricoes.length > 0 ? { restricoes_da_mensagem: i.restricoes } : {}),
    ...(casa ? { casa_da_mensagem: casa } : {}),
    ...(retorno
      ? {
          retorno: {
            resultado: retorno.resultado,
            registrado: retorno.retorno_id !== undefined,
            ...(retorno.titulo ? { titulo: retorno.titulo } : {}),
          },
        }
      : {}),
    ...(i.fato_de_rotina ? { fato_de_rotina: i.fato_de_rotina } : {}),
  }
}

function modelosComApoio(atual: unknown, apoio: Apoio): Record<string, unknown> {
  const base = typeof atual === "object" && atual !== null ? atual : {}
  return { ...base, apoio: [apoio.modelo] }
}

export function createConversation(deps: Deps) {
  const { stores, tx, kb, clock, telemetry, runs, interpreter, companion } = deps

  async function etapaAoVivo(x: Execucao, etapa: NovaEtapa): Promise<RunEtapa> {
    x.aoVivo?.({ tipo: "etapa_iniciada", etapa: { tipo: etapa.tipo, nome: etapa.nome } })
    const gravada = await runs.gravarEtapa(x.contaId, x.run.id, etapa)
    x.aoVivo?.({ tipo: "etapa_concluida", etapa: gravada })
    return gravada
  }

  async function interpretarTexto(x: Execucao, texto: string): Promise<Interpretado> {
    const { contaId, run } = x
    const pendentes = (await stores.outcomes.pendentes(contaId)).slice(
      0,
      config.conversa.interprete.pendentesNoContexto,
    )
    const conversa = await lerConversaDoDia(stores, {
      contaId,
      dia: run.dia,
      agora: clock.now(),
      runAtualId: run.id,
      limite: config.conversa.interprete.mensagensNoContexto,
    })
    x.aoVivo?.({ tipo: "etapa_iniciada", etapa: { tipo: "interprete", nome: "interprete" } })
    const r = await interpreter.interpretar({ texto, atalhos: x.m.atalhos, conversa, pendentes })
    const base = { tipo: "interprete" as const, nome: "interprete", duracao_ms: r.duracao_ms }
    if (!r.ok) {
      const etapa = await runs.gravarEtapa(contaId, run.id, {
        ...base,
        status: "falhou",
        resumo: r.motivo,
        modelo: null,
        tokens_entrada: 0,
        tokens_saida: 0,
      })
      x.aoVivo?.({ tipo: "etapa_concluida", etapa })
      return {}
    }
    const { interpretacao } = r
    const etapa = await runs.gravarEtapa(contaId, run.id, {
      ...base,
      status: "ok",
      resumo: interpretacao.alerta ? "alerta" : interpretacao.intencoes.join(","),
      modelo: r.modelo,
      tokens_entrada: r.tokens.entrada,
      tokens_saida: r.tokens.saida,
    })
    x.aoVivo?.({ tipo: "etapa_concluida", etapa })
    return {
      interpretacao,
      apoio: { modelo: r.modelo, tokens: r.tokens, duracao_ms: r.duracao_ms },
    }
  }

  async function interpretar(x: Execucao): Promise<Interpretado> {
    if (!x.m.texto) return { interpretacao: interpretacaoDosAtalhos(x.m.atalhos) }
    return interpretarTexto(x, x.m.texto)
  }

  async function semModelo(x: Execucao): Promise<Resultado> {
    const entrada: EntradaDoAcompanhante = {
      intencoes: ["momento"],
      estados: x.m.atalhos,
      evitar_da_mensagem: [],
    }
    const r = await companion.responder(x.contaId, entrada, {
      run: x.run,
      semModelo: true,
      aoVivo: x.aoVivo,
    })
    return { saida: r.saida, incomodo: false }
  }

  async function viaCodigo(
    x: Execucao,
    caminho: CaminhoDeCodigo,
    ctx: ContextoDoCaminho,
    apoio: Apoio | undefined,
  ): Promise<Resultado> {
    const r = await resolverCaminhoDeCodigo(caminho, ctx)
    if (r.etapa) await etapaAoVivo(x, r.etapa)
    const saida = saidaDeCodigo(r.texto, r.anotacoes)
    await runs.encerrar(x.contaId, x.run.id, "done", {
      saida,
      modelos: { apoio: apoio ? [apoio.modelo] : [] },
      tokens_entrada: apoio?.tokens.entrada ?? 0,
      tokens_saida: apoio?.tokens.saida ?? 0,
      latencia_ms: apoio?.duracao_ms ?? 0,
      ...(caminho === "alerta" ? { com_incomodo: true } : {}),
    })
    return { saida, incomodo: caminho === "alerta" }
  }

  // Soma o Intérprete aos totais do run que o Acompanhante já fechou (D8).
  async function somarApoio(x: Execucao, apoio: Apoio | undefined) {
    if (!apoio) return {}
    const atual = await stores.runs.buscar(x.contaId, x.run.id)
    return {
      modelos: modelosComApoio(atual?.modelos, apoio),
      tokens_entrada: (atual?.tokens_entrada ?? 0) + apoio.tokens.entrada,
      tokens_saida: (atual?.tokens_saida ?? 0) + apoio.tokens.saida,
    }
  }

  async function viaAcompanhante(
    x: Execucao,
    ctx: ContextoDoCaminho,
    intencoes: string[],
    apoio: Apoio | undefined,
  ): Promise<Resultado> {
    await registrarRetornoDaConversa(ctx)
    await gravarItensDoDia(ctx)
    const entrada = entradaDoAcompanhante(x.m.texto, ctx.interpretacao, intencoes)
    const r = await companion.responder(x.contaId, entrada, { run: x.run, aoVivo: x.aoVivo })
    const saida = { ...r.saida, anotacoes: await anotacoesDaMensagem(ctx) }
    await stores.runs.atualizar(x.contaId, x.run.id, { saida, ...(await somarApoio(x, apoio)) })
    return { saida, incomodo: Boolean(ctx.interpretacao.incomodo) }
  }

  async function seguirCaminho(x: Execucao, i: Interpretacao, apoio?: Apoio): Promise<Resultado> {
    const { contaId, run } = x
    const { caminho, intencoes } = escolherCaminho(i)
    await stores.runs.atualizar(contaId, run.id, { caminho, intencoes })
    for (const intencao of intencoes) telemetry.contador("ritu_run_intencao_total", { intencao })
    const ctx: ContextoDoCaminho = {
      stores,
      tx,
      kb,
      telemetry,
      contaId,
      dia: run.dia,
      perfil: x.perfil,
      interpretacao: i,
    }
    if (ehCaminhoDeCodigo(caminho)) return viaCodigo(x, caminho, ctx, apoio)
    return viaAcompanhante(x, ctx, intencoes, apoio)
  }

  async function responderMensagem(x: Execucao, estado: { gravada: boolean }) {
    const { interpretacao, apoio } = await interpretar(x)
    const r = interpretacao ? await seguirCaminho(x, interpretacao, apoio) : await semModelo(x)
    await stores.messages.gravar(x.contaId, {
      run_id: x.run.id,
      autor: "agente",
      texto: r.saida.resposta,
      com_incomodo: false,
      dia: x.run.dia,
    })
    estado.gravada = true
    if (r.incomodo) await stores.messages.marcarIncomodoDoRun(x.contaId, x.run.id)
    return { saida: r.saida, interpretacao }
  }

  async function fecharComoFalho(x: Execucao, saida?: SaidaDoAcompanhante): Promise<void> {
    const atual = await stores.runs.buscar(x.contaId, x.run.id)
    if (atual?.status !== "running") return
    await runs.encerrar(x.contaId, x.run.id, "failed", saida ? { saida } : {})
  }

  async function respostaDoRun(
    x: Execucao,
    saida: SaidaDoAcompanhante,
    interpretacao?: Interpretacao,
  ): Promise<RespostaDaConversa> {
    const final = await stores.runs.buscar(x.contaId, x.run.id)
    return {
      run_id: x.run.id,
      status: final?.status ?? x.run.status,
      caminho: final?.caminho ?? x.run.caminho,
      saida,
      ...(interpretacao ? { interpretacao } : {}),
    }
  }

  async function respostaSegura(x: Execucao): Promise<RespostaDaConversa> {
    const saida = saidaSegura()
    await fecharComoFalho(x, saida)
    await stores.messages.gravar(x.contaId, {
      run_id: x.run.id,
      autor: "agente",
      texto: saida.resposta,
      com_incomodo: false,
      dia: x.run.dia,
    })
    return respostaDoRun(x, saida)
  }

  async function rodar(x: Execucao): Promise<RespostaDaConversa> {
    try {
      await stores.messages.gravar(x.contaId, {
        run_id: x.run.id,
        autor: "pessoa",
        texto: textoDaMensagem(x.m, kb),
        com_incomodo: false,
        dia: x.run.dia,
      })
    } catch (e) {
      await fecharComoFalho(x)
      throw e
    }
    const estado = { gravada: false }
    try {
      const { saida, interpretacao } = await responderMensagem(x, estado)
      return await respostaDoRun(x, saida, interpretacao)
    } catch (e) {
      if (estado.gravada) throw e
      return respostaSegura(x)
    }
  }

  return {
    async conversar(
      contaId: string,
      mensagem: MensagemRecebida,
      opts?: { aoVivo?: AoVivo },
    ): Promise<RespostaDaConversa> {
      const m = validar(mensagem)
      const perfil = await stores.profiles.ler(contaId)
      const run = await runs.iniciarRun(contaId, {
        caminho: "acompanhante",
        intencoes: [],
        fuso: perfil.cidade_fuso ?? undefined,
      })
      const x: Execucao = { contaId, run, perfil, m, aoVivo: opts?.aoVivo }
      return runs.comSpanDoRun(contaId, run.id, () => rodar(x))
    },
  }
}
