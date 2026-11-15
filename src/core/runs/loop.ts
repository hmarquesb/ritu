import { loop } from "@config/loop"
import type { Clock } from "@/core/clock"
import { LlmError } from "@/core/llm/errors"
import type { FornecedorDeModelo } from "@/core/llm/fornecedor"
import type { SpanAtivo, Telemetry } from "@/core/telemetry/ports"
import type { ToolContext } from "@/core/tools/tool"
import type { AgentRuntime, ResultadoDePasso } from "./agent-runtime"
import type { DefinicaoDoAgente, Pendencia } from "./agente"
import type { Checkpoint } from "./checkpoint"
import { etapaDe, iniciarEtapa, processarChamadas, registrarEtapa } from "./loop-passo"
import type { NovaEtapa, RunEtapa, TipoDeEtapa } from "./ports"

export type FimDoTrecho =
  | { tipo: "entregue"; saida: unknown }
  | { tipo: "pausa"; pendencia: Pendencia }
  | { tipo: "limite"; motivo: "chamadas" | "tempo" | "tokens" | "validacao" }
  | { tipo: "sem_modelo" }
  | { tipo: "erro"; codigo: string }

export type EventoAoVivo =
  | { tipo: "etapa_iniciada"; etapa: { tipo: TipoDeEtapa; nome: string } }
  | { tipo: "etapa_concluida"; etapa: RunEtapa }
  | { tipo: "pensamento"; texto: string } // a frase que o modelo escreve antes de usar uma tool

export type DepsDoLoop = {
  runtime: AgentRuntime
  modelo: FornecedorDeModelo
  clock: Clock
  telemetry: Telemetry
  /** Devolve a etapa gravada; sem ela (undefined), o loop monta uma para `etapa_concluida`. */
  gravarEtapa(etapa: NovaEtapa): Promise<RunEtapa | undefined>
  aoVivo?: (e: EventoAoVivo) => void
}

/** Estado de trabalho de um trecho (interno ao loop). */
export type Ambiente = {
  agente: DefinicaoDoAgente
  ctx: ToolContext
  deps: DepsDoLoop
  estado: Checkpoint
  ordemLocal: number
  /** Atualiza `estado.ativo_ms` e o devolve. */
  medirAtivo(): number
}

type Chamada = { fim: FimDoTrecho } | { resultado: ResultadoDePasso }

const PENSAMENTO_MAX = 160
// Salvaguarda contra um fornecedor que sempre devolve rate_limit.
const MAX_TROCAS_POR_CHAMADA = 8

export function novoCheckpoint(
  agente: DefinicaoDoAgente,
  mensagemInicial: string,
  dados: unknown,
): Checkpoint {
  return {
    versao: 1,
    agente: agente.nome,
    prompt_versao: agente.prompt_versao,
    mensagens: [{ papel: "pessoa", conteudo: mensagemInicial }],
    chamadas_de_modelo: 0,
    tokens: { entrada: 0, saida: 0 },
    entregas_recusadas: 0,
    pausas: 0,
    ativo_ms: 0,
    dados,
  }
}

export function retomarCheckpoint(
  estado: Checkpoint,
  pendencia: Pendencia,
  resultadoDaTool: unknown,
): Checkpoint {
  const id = pendencia.chamada_id ?? ""
  const nome =
    estado.mensagens
      .flatMap((m) => (m.papel === "agente" ? m.chamadas : []))
      .find((c) => c.id === id)?.nome ?? ""
  return {
    ...estado,
    mensagens: [
      ...estado.mensagens,
      { papel: "tool", chamada_id: id, nome, resultado: resultadoDaTool },
    ],
    pausas: estado.pausas + 1,
  }
}

function limiteAtingido(amb: Ambiente): FimDoTrecho | undefined {
  const e = amb.estado
  if (e.entregas_recusadas >= loop.maxEntregasRecusadas) {
    return { tipo: "limite", motivo: "validacao" }
  }
  if (e.chamadas_de_modelo >= loop.maxChamadasDeModelo) {
    return { tipo: "limite", motivo: "chamadas" }
  }
  if (amb.medirAtivo() > loop.timeoutTrechoMs) return { tipo: "limite", motivo: "tempo" }
  if (e.tokens.entrada + e.tokens.saida > loop.maxTokensPorRun) {
    return { tipo: "limite", motivo: "tokens" }
  }
  return undefined
}

function pedidoDoPasso(amb: Ambiente, modelo: string) {
  const { agente, estado } = amb
  const restante = loop.timeoutTrechoMs - amb.medirAtivo()
  return {
    instrucoes: agente.instrucoes,
    mensagens: estado.mensagens.slice(),
    tools: [...agente.tools, ...agente.controle].map((t) => ({
      name: t.name,
      description: t.description,
      input: t.input,
    })),
    modelo,
    timeoutMs: Math.max(1, Math.min(loop.timeoutPassoMs, restante)),
  }
}

function aoSucesso(amb: Ambiente, modelo: string, r: ResultadoDePasso): void {
  const e = amb.estado
  e.chamadas_de_modelo += 1
  e.tokens.entrada += r.tokens_entrada
  e.tokens.saida += r.tokens_saida
  e.modelo = modelo
}

async function tentarModelo(
  amb: Ambiente,
  modelo: string,
): Promise<{ resultado: ResultadoDePasso } | { erro: LlmError }> {
  try {
    return { resultado: await amb.deps.runtime.passo(pedidoDoPasso(amb, modelo)) }
  } catch (erro) {
    if (!(erro instanceof LlmError)) throw erro
    return { erro }
  }
}

type SessaoLlm = {
  tentativas: number
  trocas: number
  falhasNoModelo: number
  iniciada: boolean
  inicio: number
}

type Escolha = NonNullable<Awaited<ReturnType<FornecedorDeModelo["proximo"]>>>

async function prepararTentativa(amb: Ambiente, span: SpanAtivo, st: SessaoLlm, e: Escolha) {
  if (e.troca) {
    span.atribuir({ "llm.troca_de_modelo": true })
    await registrarEtapa(
      amb,
      etapaDe({
        tipo: "troca_de_modelo",
        nome: e.modelo,
        status: "ok",
        duracao_ms: 0,
        resumo: e.troca.motivo,
      }),
    )
  }
  if (!st.iniciada) iniciarEtapa(amb, "llm", e.modelo)
  st.iniciada = true
  st.tentativas += 1
  span.atribuir({ "gen_ai.request.model": e.modelo, "llm.tentativas": st.tentativas })
}

async function concluirChamada(
  amb: Ambiente,
  span: SpanAtivo,
  st: SessaoLlm,
  modelo: string,
  r: ResultadoDePasso,
): Promise<Chamada> {
  aoSucesso(amb, modelo, r)
  await amb.deps.modelo.usou(modelo, { entrada: r.tokens_entrada, saida: r.tokens_saida })
  span.atribuir({
    "gen_ai.usage.input_tokens": r.tokens_entrada,
    "gen_ai.usage.output_tokens": r.tokens_saida,
  })
  await registrarEtapa(
    amb,
    etapaDe({
      tipo: "llm",
      nome: modelo,
      status: "ok",
      duracao_ms: amb.deps.clock.now().getTime() - st.inicio,
      modelo,
      tokens_entrada: r.tokens_entrada,
      tokens_saida: r.tokens_saida,
    }),
  )
  return { resultado: r }
}

/** rate_limit troca de modelo sem contar chamada; os demais erros contam e repetem uma vez. */
async function tratarFalha(
  amb: Ambiente,
  st: SessaoLlm,
  modelo: string,
  erro: LlmError,
): Promise<"trocar" | "repetir" | "encerrar"> {
  amb.deps.telemetry.contador("ritu_llm_erros_total", { "erro.codigo": erro.code })
  await amb.deps.modelo.falhou(modelo, erro)
  if (erro.code === "rate_limit") {
    st.trocas += 1
    return "trocar"
  }
  amb.estado.chamadas_de_modelo += 1
  st.falhasNoModelo += 1
  return st.falhasNoModelo < 2 ? "repetir" : "encerrar"
}

async function encerrarComErro(
  amb: Ambiente,
  span: SpanAtivo,
  st: SessaoLlm,
  modelo: string,
  erro: LlmError,
): Promise<Chamada> {
  span.falhar(erro.code)
  await registrarEtapa(
    amb,
    etapaDe({
      tipo: "erro",
      nome: erro.code,
      status: "falhou",
      duracao_ms: amb.deps.clock.now().getTime() - st.inicio,
      modelo,
    }),
  )
  return { fim: { tipo: "erro", codigo: erro.code } }
}

async function sessaoLlm(amb: Ambiente, span: SpanAtivo): Promise<Chamada> {
  const st: SessaoLlm = {
    tentativas: 0,
    trocas: 0,
    falhasNoModelo: 0,
    iniciada: false,
    inicio: amb.deps.clock.now().getTime(),
  }
  let escolha = await amb.deps.modelo.proximo()
  while (escolha) {
    await prepararTentativa(amb, span, st, escolha)
    const t = await tentarModelo(amb, escolha.modelo)
    if ("resultado" in t) return concluirChamada(amb, span, st, escolha.modelo, t.resultado)
    const decisao = await tratarFalha(amb, st, escolha.modelo, t.erro)
    if (decisao === "encerrar") return encerrarComErro(amb, span, st, escolha.modelo, t.erro)
    if (decisao === "trocar") {
      escolha = st.trocas > MAX_TROCAS_POR_CHAMADA ? null : await amb.deps.modelo.proximo()
    }
  }
  span.falhar("sem_modelo")
  return { fim: { tipo: "sem_modelo" } }
}

function chamarModelo(amb: Ambiente): Promise<Chamada> {
  return amb.deps.telemetry.span("llm.chamada", {}, (span) => sessaoLlm(amb, span))
}

async function aplicarResultado(
  amb: Ambiente,
  r: ResultadoDePasso,
): Promise<FimDoTrecho | undefined> {
  const { estado, agente, deps } = amb
  estado.mensagens.push({
    papel: "agente",
    ...(r.texto === undefined ? {} : { texto: r.texto }),
    chamadas: r.chamadas,
  })
  if (r.chamadas.length === 0) {
    estado.mensagens.push({ papel: "sistema", conteudo: agente.lembreteDeEntrega })
    return undefined
  }
  if (r.texto?.trim()) {
    deps.aoVivo?.({ tipo: "pensamento", texto: r.texto.slice(0, PENSAMENTO_MAX) })
  }
  return processarChamadas(amb, r.chamadas)
}

function passo(amb: Ambiente): Promise<FimDoTrecho | undefined> {
  const ordem = amb.estado.chamadas_de_modelo + 1
  return amb.deps.telemetry.span("agente.passo", { "passo.ordem": ordem }, async () => {
    const chamada = await chamarModelo(amb)
    if ("fim" in chamada) return chamada.fim
    return aplicarResultado(amb, chamada.resultado)
  })
}

async function rodar(amb: Ambiente): Promise<FimDoTrecho> {
  for (;;) {
    const limite = limiteAtingido(amb)
    if (limite) return limite
    const fim = await passo(amb)
    if (fim) return fim
  }
}

export async function executarTrecho(
  agente: DefinicaoDoAgente,
  estado: Checkpoint,
  ctx: ToolContext,
  deps: DepsDoLoop,
): Promise<{ fim: FimDoTrecho; estado: Checkpoint }> {
  const inicio = deps.clock.now().getTime()
  const ativoAnterior = estado.ativo_ms
  const amb: Ambiente = {
    agente,
    ctx,
    deps,
    estado: { ...estado, mensagens: estado.mensagens.slice(), tokens: { ...estado.tokens } },
    ordemLocal: 0,
    medirAtivo() {
      this.estado.ativo_ms = ativoAnterior + (deps.clock.now().getTime() - inicio)
      return this.estado.ativo_ms
    },
  }
  let fim: FimDoTrecho
  try {
    fim = await rodar(amb)
  } catch {
    fim = { tipo: "erro", codigo: "inesperado" }
  }
  amb.medirAtivo()
  return { fim, estado: amb.estado }
}
