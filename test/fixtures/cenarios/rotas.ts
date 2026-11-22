import type { DepsDaRota } from "@/app/_lib/rota"
import { rotasDaCasa } from "@/app/_rotas/casa"
import { rotasDaConversa } from "@/app/_rotas/conversa"
import { rotasDeFluxoDeRun } from "@/app/_rotas/fluxo-de-run"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { ResultadoDaAprovacao } from "@/core/conversation/aprovar"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { EventoDaTela } from "@/core/conversation/eventos"
import type { Retorno } from "@/core/outcomes/ports"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Transactor } from "@/core/stores"
import type { ResultadoDaTroca } from "@/core/touches"
import { type Container, createContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import type { DepsDoCenario } from "./montar"
import {
  MAXIMO_DE_RETOMADAS,
  type OpcoesDaRodada,
  type RodadaDoCenario,
  type ToqueFeito,
} from "./rodar"
import type { Cenario, Toque } from "./tipos"

type Final = RespostaDaConversa | RespostaDoRun
type Devolvido = Final | ResultadoDaAprovacao

// Resultados de `aprovar` ficam marcados para não serem confundidos com o `final` de um run.
const deAprovacao = new WeakSet<object>()

// Os stores em memória do cenário são também o Transactor; as rotas não usam `tx` direto.
function ehTransactor(s: DepsDoCenario["stores"]): s is DepsDoCenario["stores"] & Transactor {
  return "emTransacao" in s
}

// Container das rotas com as dependências do cenário; o `conversation` é embrulhado para guardar o que devolve.
export function containerDoCenario(deps: DepsDoCenario): {
  container: Container
  devolvidos: Devolvido[]
} {
  const devolvidos: Devolvido[] = []
  const guardar = <T extends Devolvido>(r: T, aprovacao = false): T => {
    if (aprovacao) deAprovacao.add(r)
    devolvidos.push(r)
    return r
  }
  const original = deps.conversation
  const conversation: DepsDoCenario["conversation"] = {
    conversar: async (...a) => guardar(await original.conversar(...a)),
    continuar: async (...a) => guardar(await original.continuar(...a)),
    aprovar: async (...a) => guardar(await original.aprovar(...a), true),
  }
  const container = createContainer({
    clock: deps.clock,
    stores: deps.stores,
    ...(ehTransactor(deps.stores) ? { tx: deps.stores } : {}),
    telemetry: deps.telemetry,
    ledger: deps.ledger,
    router: deps.router,
    weather: deps.weather,
    runtime: deps.runtime,
    llm: deps.llm,
    runs: deps.runs,
    companion: deps.companion,
    interpreter: deps.interpreter,
    judge: deps.judge,
    touches: deps.touches,
    memory: deps.memory,
    routine: deps.routine,
    patterns: deps.patterns,
    limiter: createMemoryLimiter(),
    conversation,
  })
  // Fora de uma requisição o `after()` do Next não existe: quem descarrega a telemetria é o chamador.
  Object.defineProperty(container, "telemetriaLigada", { value: false, configurable: true })
  return { container, devolvidos }
}

export type PassoDeRota = {
  rota: string
  status: number
  eventos?: EventoDaTela[]
  erroDeSchema?: string
}

export type RodadaPelasRotas = RodadaDoCenario & { passos: PassoDeRota[] }

// Rota com status ≠ 200: a rodada para aqui; `passos` inclui o passo que falhou.
export class RotaFalhouError extends Error {
  constructor(readonly passos: PassoDeRota[]) {
    const ultimo = passos.at(-1)
    super(`rota ${ultimo?.rota ?? "?"} respondeu ${ultimo?.status ?? "?"}`)
    this.name = "RotaFalhouError"
  }
}

type Linha = Record<string, unknown>

// Forma mínima de cada evento da tela (não há schema zod exportado em core/conversation/eventos).
function eventoValido(l: unknown): l is EventoDaTela {
  if (typeof l !== "object" || l === null) return false
  const e = l as Linha
  switch (e.tipo) {
    case "inicio":
      return typeof e.run_id === "string"
    case "etapa":
      return typeof e.frase === "object" && e.frase !== null
    case "fim":
      return typeof e.visao === "object" && e.visao !== null && typeof e.pendentes === "number"
    case "erro":
      return typeof e.erro === "string"
    default:
      return false
  }
}

function lerEventos(texto: string): { eventos: EventoDaTela[]; erroDeSchema?: string } {
  const eventos: EventoDaTela[] = []
  let erroDeSchema: string | undefined
  for (const linha of texto.split("\n").filter((l) => l.trim() !== "")) {
    let valor: unknown
    try {
      valor = JSON.parse(linha)
    } catch {
      erroDeSchema ??= linha
      continue
    }
    if (eventoValido(valor)) eventos.push(valor)
    else erroDeSchema ??= linha
  }
  return { eventos, ...(erroDeSchema === undefined ? {} : { erroDeSchema }) }
}

type Rotas = {
  fluxo: ReturnType<typeof rotasDeFluxoDeRun>
  conversa: ReturnType<typeof rotasDaConversa>
  casa: ReturnType<typeof rotasDaCasa>
}

type Rodada = {
  deps: DepsDoCenario
  contaId: string
  c: Cenario
  opts: OpcoesDaRodada
  rotas: Rotas
  devolvidos: Devolvido[]
  passos: PassoDeRota[]
}

const noRun = (id: string) => ({ params: Promise.resolve({ id }) })

function pedido(caminho: string, corpo: unknown): Request {
  return new Request(`http://eval/${caminho}`, { method: "POST", body: JSON.stringify(corpo) })
}

// Entrega o pedido ao handler, registra o passo e devolve o corpo (JSON, ou os eventos do fluxo).
async function enviar(
  r: Rodada,
  rota: string,
  resposta: Promise<Response>,
  fluxo = false,
): Promise<unknown> {
  const res = await resposta
  const passo: PassoDeRota = { rota, status: res.status }
  r.passos.push(passo)
  if (res.status !== 200) throw new RotaFalhouError(r.passos)
  if (fluxo) {
    const { eventos, erroDeSchema } = lerEventos(await res.text())
    passo.eventos = eventos
    if (erroDeSchema !== undefined) passo.erroDeSchema = erroDeSchema
    return eventos
  }
  return res.json()
}

// O que a conversa devolveu desde `desde`: o último `Final` (nunca o de uma aprovação).
function finalDesde(r: Rodada, desde: number): Final {
  for (let i = r.devolvidos.length - 1; i >= desde; i--) {
    const d = r.devolvidos[i]
    if (d && !deAprovacao.has(d)) return d as Final
  }
  throw new RotaFalhouError(r.passos)
}

async function responderPausa(
  r: Rodada,
  runId: string,
  resposta: RespostaDaPessoa,
): Promise<Final> {
  const desde = r.devolvidos.length
  await enviar(
    r,
    "POST /api/runs/[id]/resposta",
    r.rotas.fluxo.responder(pedido(`api/runs/${runId}/resposta`, resposta), noRun(runId)),
    true,
  )
  return finalDesde(r, desde)
}

async function iniciar(r: Rodada, mensagem: Cenario["mensagem"]): Promise<Final> {
  const desde = r.devolvidos.length
  await enviar(r, "POST /api/runs", r.rotas.fluxo.iniciar(pedido("api/runs", mensagem)), true)
  return finalDesde(r, desde)
}

async function primeira(r: Rodada): Promise<Final> {
  if (r.c.mensagem) return iniciar(r, r.c.mensagem)
  if (r.c.entrada) return r.deps.companion.responder(r.contaId, r.c.entrada)
  throw new Error(`cenário ${r.c.nome} sem entrada nem mensagem`)
}

async function respostaDaRodada(r: Rodada, pergunta: Pergunta, i: number) {
  if (r.opts.responder) return r.opts.responder(pergunta, i)
  return r.c.respostas?.[i] ?? ({ tipo: "pular" } as RespostaDaPessoa)
}

async function pausas(
  r: Rodada,
  inicial: Final,
): Promise<{ final: Final; perguntas: RodadaDoCenario["perguntas"] }> {
  let final = inicial
  const perguntas: RodadaDoCenario["perguntas"] = []
  while (
    final.status === "waiting_for_input" &&
    final.pergunta &&
    perguntas.length < MAXIMO_DE_RETOMADAS
  ) {
    const pergunta: Pergunta = final.pergunta
    const resposta = await respostaDaRodada(r, pergunta, perguntas.length)
    perguntas.push({ pergunta, resposta })
    final = await responderPausa(r, final.run_id, resposta)
  }
  return { final, perguntas }
}

async function aprovadasDoBloco(
  r: Rodada,
  propostas: { id: string }[],
): Promise<string[] | undefined> {
  if (r.opts.decidir)
    return r.opts.decidir(propostas as Parameters<NonNullable<OpcoesDaRodada["decidir"]>>[0])
  const a = r.c.aprovacao
  if (a === undefined) return undefined
  if (a === "agora_nao") return []
  return propostas.filter((_, i) => a.aprovar.includes(i + 1)).map((p) => p.id)
}

async function bloco(r: Rodada, final: Final): Promise<RodadaDoCenario["bloco"]> {
  const propostas = final.saida?.propostas ?? []
  if (final.status !== "waiting_for_approval" || propostas.length === 0) return undefined
  const aprovadas = await aprovadasDoBloco(r, propostas)
  if (aprovadas === undefined) return undefined
  const desde = r.devolvidos.length
  await enviar(
    r,
    "POST /api/runs/[id]/aprovacao",
    r.rotas.conversa.aprovacao(
      pedido(`api/runs/${final.run_id}/aprovacao`, { aprovadas }),
      noRun(final.run_id),
    ),
  )
  const resultado = r.devolvidos
    .slice(desde)
    .reverse()
    .find((d): d is ResultadoDaAprovacao => deAprovacao.has(d))
  if (!resultado) throw new RotaFalhouError(r.passos)
  return { propostas, aprovadas, resultado }
}

function idDoRetorno(r: Rodada, final: Final, t: Extract<Toque, { tipo: "retorno" }>): string {
  const id = t.semeado
    ? r.deps.retornosSemeados[t.sugestao]
    : final.saida?.sugestoes[t.sugestao]?.retorno_id
  if (!id) throw new Error(`cenário ${r.c.nome}: toque de retorno sem id na sugestão ${t.sugestao}`)
  return id
}

async function tocarRetorno(
  r: Rodada,
  final: Final,
  t: Extract<Toque, { tipo: "retorno" }>,
): Promise<ToqueFeito> {
  const id = idDoRetorno(r, final, t)
  await enviar(
    r,
    "POST /api/retornos/[id]",
    r.rotas.casa.responderRetorno(
      pedido(`api/retornos/${id}`, { resultado: t.resultado }),
      noRun(id),
    ),
  )
  // A rota devolve a visão da tela; o retorno completo vem do store.
  const feitos: Retorno[] = await r.deps.stores.outcomes.respondidosDesde(r.contaId, new Date(0))
  const retorno = feitos.find((f) => f.id === id)
  if (!retorno) throw new Error(`cenário ${r.c.nome}: retorno ${id} não ficou respondido`)
  return { tipo: "retorno", retorno }
}

async function tocarGosto(r: Rodada, t: Extract<Toque, { tipo: "gosto" }>): Promise<ToqueFeito> {
  if (t.item.tipo !== "alimento") {
    await r.deps.touches.tocarGosto(r.contaId, t.item, t.gosto)
    return { tipo: "gosto" }
  }
  await enviar(
    r,
    "POST /api/preferencias",
    r.rotas.casa.preferencias(
      pedido("api/preferencias", { alimento_id: t.item.id, gosto: t.gosto }),
    ),
  )
  return { tipo: "gosto" }
}

async function tocarTroca(
  r: Rodada,
  final: Final,
  t: Extract<Toque, { tipo: "troca" }>,
): Promise<ToqueFeito> {
  const runId = final.run_id
  const corpo = (await enviar(
    r,
    "POST /api/runs/[id]/troca",
    r.rotas.conversa.troca(
      pedido(`api/runs/${runId}/troca`, {
        sugestao: t.sugestao,
        alimento_id: t.alimento_id,
        motivo: t.motivo,
      }),
      noRun(runId),
    ),
  )) as { resultado: ResultadoDaTroca }
  const resultado = corpo.resultado
  if (resultado.resultado !== "perguntar" || !t.resposta) return { tipo: "troca", resultado }
  const segunda = (await enviar(
    r,
    "POST /api/runs/[id]/troca/resposta",
    r.rotas.conversa.respostaDaTroca(
      pedido(`api/runs/${runId}/troca/resposta`, {
        sugestao: t.sugestao,
        alimento_id: t.alimento_id,
        candidato: resultado.pergunta.alimento_id,
        resposta: t.resposta,
      }),
      noRun(runId),
    ),
  )) as { resultado: ResultadoDaTroca }
  return { tipo: "troca", resultado, resposta: segunda.resultado }
}

function tocarUm(r: Rodada, final: Final, t: Toque): Promise<ToqueFeito> {
  switch (t.tipo) {
    case "retorno":
      return tocarRetorno(r, final, t)
    case "gosto":
      return tocarGosto(r, t)
    case "troca":
      return tocarTroca(r, final, t)
  }
}

async function toques(r: Rodada, final: Final): Promise<ToqueFeito[]> {
  const feitos: ToqueFeito[] = []
  for (const t of r.c.toques ?? []) feitos.push(await tocarUm(r, final, t))
  return feitos
}

// A mesma rodada de `rodarCenario`, mas cada passo é um `Request` entregue ao handler da rota.
// `aoVivo` não vale aqui: as etapas ao vivo saem como eventos do fluxo, em `passos`.
export async function rodarCenarioPelasRotas(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts: OpcoesDaRodada & { escopo?: string; teto?: number } = {},
): Promise<RodadaPelasRotas> {
  const { container, devolvidos } = containerDoCenario(deps)
  const rotaDeps: DepsDaRota = {
    contaDaSessao: async () => contaId,
    quemPede: () => ({
      ipHash: "eval",
      escopo: opts.escopo ?? c.nome,
      teto: opts.teto ?? 1000,
    }),
    container,
  }
  const rotas: Rotas = {
    fluxo: rotasDeFluxoDeRun(rotaDeps),
    conversa: rotasDaConversa(rotaDeps),
    casa: rotasDaCasa(rotaDeps),
  }
  const passos: PassoDeRota[] = []
  const r: Rodada = { deps, contaId, c, opts, rotas, devolvidos, passos }

  const { final, perguntas } = await pausas(r, await primeira(r))
  const blocoDecidido = await bloco(r, final)
  const feitos = c.toques?.length ? await toques(r, final) : undefined
  const rodada: RodadaDoCenario = {
    final,
    perguntas,
    ...(blocoDecidido ? { bloco: blocoDecidido } : {}),
    ...(feitos ? { toques: feitos } : {}),
  }
  if (!c.depois) return { ...rodada, passos }
  const inicio = await iniciar(r, c.depois.mensagem)
  const segunda = await pausas(r, inicio)
  return { ...rodada, depois: segunda, passos }
}
