import { describe, expect, it, vi } from "vitest"
import { apagarConta } from "@/core/accounts/apagar"
import { normalizar } from "@/core/knowledge/identificar"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import type { MemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import {
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
  cenariosDeMemoria,
  cenariosDeTelemetria,
  type DepsDoCenario,
  montarCenario,
  type OpcoesDoCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// Privacidade da telemetria: nada da pessoa, nome de alimento da base, canário ou valor fora do formato de identificador
// sai em span, evento, métrica, log, resumo de etapa ou console. Roda todos os cenários, os quatro toques e os da casa e da lista, a detecção de
// padrões e os dois caminhos de erro do modelo (troca de modelo e erro na chamada).

// Canários: texto que o código nunca deve emitir. Entram nos campos do cenário, ou pelos stores quando não há campo.
const CANARIO_TEXTO = "zibelina"
const CANARIO_NOME = "quarzo7"
const EMAIL_CANARIO = "quarzo7@zibelina.test"
const CANARIOS = [CANARIO_TEXTO, CANARIO_NOME, EMAIL_CANARIO]

// Valor de texto emitido tem forma de identificador (D9).
const FORMA_DE_IDENTIFICADOR = /^[a-z0-9][a-z0-9_.:,-]{0,63}$/

const METODOS_DE_CONSOLE = ["log", "info", "warn", "error"] as const

const NOMES_DA_BASE = [
  ...new Set(getContainer().knowledge.alimentos.map((a) => normalizar(a.nome))),
]

type Textos = { entradas: string[]; respostas: string[] }

type Execucao = {
  spans: number
  // Telemetria inteira (spans, eventos, métricas, logs), resumos das etapas e console, normalizados.
  emitido: string
  // Valores de texto de atributo, evento, rótulo e campo de log (D9).
  formas: string[]
  textos: Textos
}

type Preparada = { contaId: string; deps: DepsDoCenario; textos: Textos }

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Nome de alimento como palavra inteira (ou expressão inteira) no texto emitido.
function nomesVazados(emitido: string, nomes: string[]): string[] {
  return nomes.filter((nome) =>
    new RegExp(`(^|[^a-z0-9])${escapar(nome)}($|[^a-z0-9])`).test(emitido),
  )
}

const acrescentar = <T extends { texto?: string }>(m: T, canario: string): T =>
  m.texto === undefined ? m : { ...m, texto: `${m.texto} ${canario}` }

// Planta os canários nos campos do cenário: texto das mensagens, evitar sempre, cidade e nota de rotina.
// Mensagem só com atalhos não tem texto e fica como está.
function plantar(c: Cenario): Cenario {
  const cidade = c.perfil.cidade
  return {
    ...c,
    ...(c.entrada ? { entrada: acrescentar(c.entrada, CANARIO_TEXTO) } : {}),
    ...(c.mensagem ? { mensagem: acrescentar(c.mensagem, CANARIO_TEXTO) } : {}),
    ...(c.depois
      ? { depois: { ...c.depois, mensagem: acrescentar(c.depois.mensagem, CANARIO_TEXTO) } }
      : {}),
    perfil: {
      ...c.perfil,
      evitar_sempre: [...(c.perfil.evitar_sempre ?? []), { tipo: "texto", valor: CANARIO_TEXTO }],
      ...(cidade ? { cidade: { ...cidade, nome: `${cidade.nome} ${CANARIO_TEXTO}` } } : {}),
    },
    rotina: [...(c.rotina ?? []), { texto: `trabalho em casa ${CANARIO_NOME}`, diasAtras: 1 }],
  }
}

// Canário que não tem campo no cenário: o nome livre na casa, e o e-mail da conta, lido pelo store.
// O store de teste não tem como gravar e-mail depois de criar a conta; o e-mail entra na leitura da conta.
async function plantarPelosStores(deps: DepsDoCenario, contaId: string): Promise<void> {
  await deps.stores.pantry.registrar(contaId, [{ nome_livre: CANARIO_NOME }], "conversa")
  const contas = deps.stores.accounts
  const buscar = contas.buscar.bind(contas)
  contas.buscar = async (id) => {
    const conta = await buscar(id)
    return conta ? { ...conta, email: EMAIL_CANARIO } : undefined
  }
}

function textosDaEntrada(c: Cenario): string[] {
  return [c.entrada?.texto, c.mensagem?.texto, c.depois?.mensagem.texto].flatMap((t) =>
    t ? [normalizar(t)] : [],
  )
}

// Todo valor de texto de atributo, evento, rótulo e campo de log (D9).
function formasDe(t: MemoryTelemetry): string[] {
  const mapas = [
    ...t.spans.map((s) => s.atributos),
    ...t.eventos.map((e) => e.atributos),
    ...t.metricas.map((m) => m.rotulos),
    ...t.logs.map((l) => l.campos),
  ]
  return mapas.flatMap((m) => Object.values(m).filter((v): v is string => typeof v === "string"))
}

// Ids dos runs que abriram span `run`: as etapas deles entram nos resumos.
function idsDeRun(t: MemoryTelemetry): string[] {
  const ids = t.spans.flatMap((s) => {
    const id = s.nome === "run" ? s.atributos["run.id"] : undefined
    return typeof id === "string" ? [id] : []
  })
  return [...new Set(ids)]
}

function textoDoConsole(chamadas: unknown[][]): string {
  return chamadas
    .map((args) => args.map((a) => (typeof a === "string" ? a : String(a))).join(" "))
    .join("\n")
}

// Os spans, eventos, métricas e logs, mais os resumos das etapas e o console, num texto só.
async function emitidoDe(deps: DepsDoCenario, contaId: string, consoleTexto: string) {
  const t = deps.telemetry
  const etapas = await Promise.all(idsDeRun(t).map((id) => deps.stores.runs.etapas(contaId, id)))
  const resumos = etapas.flat().map((e) => e.resumo ?? "")
  const telemetria = JSON.stringify({
    spans: t.spans,
    eventos: t.eventos,
    metricas: t.metricas,
    logs: t.logs,
  })
  return normalizar([telemetria, ...resumos, consoleTexto].join("\n"))
}

// Roda um fluxo com o console espionado e junta tudo o que ele emitiu.
async function medir(corpo: () => Promise<Preparada>): Promise<Execucao> {
  const chamadas: unknown[][] = []
  const espioes = METODOS_DE_CONSOLE.map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      chamadas.push(args)
    }),
  )
  try {
    const { contaId, deps, textos } = await corpo()
    const emitido = await emitidoDe(deps, contaId, textoDoConsole(chamadas))
    return {
      spans: deps.telemetry.spans.length,
      emitido,
      formas: formasDe(deps.telemetry),
      textos,
    }
  } finally {
    for (const e of espioes) e.mockRestore()
  }
}

// Um cenário inteiro: montagem, casa e conta plantadas, rodada até o fim, com as duas mensagens se houver.
async function preparadaDoCenario(base: Cenario, opts: OpcoesDoCenario = {}): Promise<Preparada> {
  const c = plantar(base)
  const { contaId, deps } = await montarCenario(c, opts)
  await plantarPelosStores(deps, contaId)
  const rodada = await rodarCenario(deps, contaId, c)
  const finais = [rodada.final, rodada.depois?.final].flatMap((f) => (f ? [f] : []))
  const respostas = finais.map((f) => normalizar(f.saida?.resposta ?? "")).filter((r) => r !== "")
  return { contaId, deps, textos: { entradas: textosDaEntrada(c), respostas } }
}

function cenarioBase(nome: string): Cenario {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// Os quatro toques sobre um run entregue (chá do frio-agitada), mais os da casa, da lista e da memória, como na cobertura.
async function preparadaDosToques(): Promise<Preparada> {
  const c = plantar(cenarioBase("frio-agitada"))
  if (!c.entrada) throw new Error("frio-agitada sem entrada")
  const { contaId, deps } = await montarCenario(c)
  await plantarPelosStores(deps, contaId)
  const r = await deps.companion.responder(contaId, c.entrada)
  if (r.status !== "done" || !r.saida) throw new Error("run sem saída")
  const retornoId = r.saida.sugestoes[0]?.retorno_id
  if (!retornoId) throw new Error("sugestão sem retorno_id")
  await deps.touches.tocarVoto(contaId, r.run_id, "up")
  await deps.touches.tocarGosto(contaId, { tipo: "alimento", id: "gengibre" }, "gosta")
  await deps.touches.trocarIngrediente(contaId, {
    runId: r.run_id,
    sugestao: 0,
    alimento_id: "canela",
    motivo: "trocar",
  })
  await deps.touches.tocarRetorno(contaId, retornoId, "ajudou")
  await deps.touches.tocarCasa(contaId, { acao: "adicionar_texto", texto: CANARIO_TEXTO })
  await deps.touches.tocarLista(contaId, { acao: "por", alimento_id: "gengibre" })
  await deps.touches.tocarLista(contaId, { acao: "tirar", alimento_id: "gengibre" })
  await tocarMemoriaComCanario(deps, contaId)
  const respostas = [normalizar(r.saida.resposta ?? "")].filter((t) => t !== "")
  return { contaId, deps, textos: { entradas: textosDaEntrada(c), respostas } }
}

// Os toques de memória da 020: a nota corrigida leva o canário no texto, e o gosto e o esquecer usam um alimento da base.
async function tocarMemoriaComCanario(deps: DepsDoCenario, contaId: string): Promise<void> {
  const nota = await deps.stores.routine.anotar(contaId, `${CANARIO_NOME} em casa`)
  await deps.touches.tocarMemoria(contaId, {
    acao: "nota_corrigir",
    nota_id: nota.id,
    texto: `${CANARIO_TEXTO} em casa`,
  })
  await deps.touches.tocarMemoria(contaId, {
    acao: "gosto",
    item_tipo: "alimento",
    item_id: "gengibre",
    gosto: "gosta",
  })
  await deps.touches.tocarMemoria(contaId, {
    acao: "esquecer",
    item_tipo: "alimento",
    item_id: "gengibre",
  })
}

// Apagar a conta: a telemetria dela (`ritu_conta_apagada_total`) leva só o tipo, sem nada da pessoa.
async function preparadaDaContaApagada(): Promise<Preparada> {
  const preparada = await preparadaDoCenario(cenarioBase("frio-agitada"))
  const conta = await preparada.deps.stores.accounts.buscar(preparada.contaId)
  if (!conta) throw new Error("conta do cenário ausente")
  await apagarConta({ stores: preparada.deps.stores, telemetry: preparada.deps.telemetry }, conta)
  return preparada
}

// Troca de modelo: o papel de decisão com o principal esgotado.
function preparadaDaTroca(): Promise<Preparada> {
  return preparadaDoCenario(cenarioBase("frio-agitada"), { esgotar: "decisao" })
}

// Erro na chamada do modelo: o Intérprete recebe rate_limit antes da resposta.
function preparadaDoErroDoModelo(): Promise<Preparada> {
  const base = cenariosDeTelemetria["llm-erro"]
  if (!base?.interpretacao) throw new Error("cenário llm-erro sem interpretação")
  const llm = createFakeLlm([{ erro: "rate_limit" }, base.interpretacao, { apontamentos: [] }])
  return preparadaDoCenario(base, { llm })
}

// Detecção diária de padrões num cenário com histórico.
async function preparadaDaDeteccao(): Promise<Preparada> {
  const base = cenariosDeMemoria["padrao-confirmado"]
  if (!base) throw new Error("cenário padrao-confirmado ausente")
  const c = plantar(base)
  const { contaId, deps } = await montarCenario(c)
  await plantarPelosStores(deps, contaId)
  await deps.patterns.detectarPadroes()
  return { contaId, deps, textos: { entradas: textosDaEntrada(c), respostas: [] } }
}

// Todo cenário de todo registro. Cada fluxo é um nome e a função que o roda; o cache deixa cada um rodar uma vez só.
const REGISTROS: Record<string, Cenario>[] = [
  cenarios,
  cenariosDeConversa,
  cenariosComPausa,
  cenariosComAprovacao,
  cenariosDeAprendizado,
  cenariosDeMemoria,
  cenariosDeGuardrails,
  cenariosDeTelemetria,
]

const FLUXOS = new Map<string, () => Promise<Execucao>>()

for (const registro of REGISTROS) {
  for (const [nome, c] of Object.entries(registro)) {
    if (FLUXOS.has(nome)) throw new Error(`cenário com nome repetido: ${nome}`)
    FLUXOS.set(nome, () => medir(() => preparadaDoCenario(c)))
  }
}
FLUXOS.set("toques (frio-agitada)", () => medir(preparadaDosToques))
FLUXOS.set("troca de modelo (frio-agitada)", () => medir(preparadaDaTroca))
FLUXOS.set("erro na chamada do modelo (llm-erro)", () => medir(preparadaDoErroDoModelo))
FLUXOS.set("detecção de padrões (padrao-confirmado)", () => medir(preparadaDaDeteccao))
FLUXOS.set("conta apagada (frio-agitada)", () => medir(preparadaDaContaApagada))

const cache = new Map<string, Promise<Execucao>>()

function execucao(nome: string): Promise<Execucao> {
  let pronta = cache.get(nome)
  if (!pronta) {
    const fluxo = FLUXOS.get(nome)
    if (!fluxo) throw new Error(`fluxo ausente: ${nome}`)
    pronta = fluxo()
    cache.set(nome, pronta)
  }
  return pronta
}

const NOMES = [...FLUXOS.keys()]

function nomesDeAlimentoDoEmitido(emitido: string): string[] {
  return nomesVazados(emitido, NOMES_DA_BASE)
}

describe("privacidade da telemetria: os cenários, os toques, a detecção e os erros", () => {
  it.each(NOMES)("%s: a telemetria tem spans, sem o que isso prova nada", async (nome) => {
    const { spans } = await execucao(nome)
    expect(spans).toBeGreaterThan(0)
  })

  it.each(NOMES)(
    "%s: o texto da entrada e da resposta não aparece em span, evento, métrica, log, resumo ou console",
    async (nome) => {
      const { emitido, textos } = await execucao(nome)
      const vazados = [...textos.entradas, ...textos.respostas].filter((t) => emitido.includes(t))
      expect(vazados).toEqual([])
    },
  )

  it.each(NOMES)(
    "%s: nenhum canário nem nome de alimento da base aparece em nenhuma saída",
    async (nome) => {
      const { emitido } = await execucao(nome)
      expect(CANARIOS.filter((c) => emitido.includes(c))).toEqual([])
      expect(nomesDeAlimentoDoEmitido(emitido)).toEqual([])
    },
  )

  it.each(NOMES)(
    "%s: todo valor de texto em span, evento, métrica ou log tem forma de identificador",
    async (nome) => {
      const { formas } = await execucao(nome)
      expect(formas.filter((v) => !FORMA_DE_IDENTIFICADOR.test(v))).toEqual([])
    },
  )
})
