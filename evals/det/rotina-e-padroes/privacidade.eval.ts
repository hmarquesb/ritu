import { describe, expect, it, vi } from "vitest"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import { ATRIBUTOS_PERMITIDOS } from "@/core/telemetry/nomes"
import { getContainer } from "@/infra/container"
import {
  cenariosDeMemoria,
  type DepsDoCenario,
  montarCenario,
  type RodadaDoCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Privacidade da 012: nota, resumo, frase e chave de padrão, nome e id de alimento, título e mensagem não vão para span,
// métrica, log nem resumo de etapa; os spans da Memória e da detecção só levam os seus atributos; e o que fica guardado
// em rotina e padrões não tem palavra de incômodo.

const kb = getContainer().knowledge
const PERMITIDOS: ReadonlySet<string> = new Set(ATRIBUTOS_PERMITIDOS)

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

// Palavras de 5 letras ou mais (sem acento), como a privacidade manda conferir.
function palavrasLongas(texto: string): string[] {
  return texto
    .split(/[^\p{L}]+/u)
    .map(norm)
    .filter((p) => p.length >= 5)
}

// Trecho de nome, id, título, nota ou frase: vaza se estiver no valor; trecho de 3 letras ou menos só casa o valor inteiro.
const trechoVaza = (valor: string, trecho: string) =>
  trecho.length <= 3 ? valor === trecho : valor.includes(trecho)

// Palavra da pessoa vaza só como token inteiro: "tenho" não casa com o motivo "nao_tenho" (enum fechado).
const tokens = (valor: string) => valor.split(/[^\p{L}_-]+/u).filter(Boolean)

type Termos = { trechos: string[]; palavras: string[] }

// O que a conta guardou sobre rotina e padrões: texto de notas ativas, todas as versões de resumo e frase e chave de padrão.
type Guardado = { notas: string[]; resumos: string[]; padroes: string[] }

type Rodado = {
  c: CenarioDeConversa
  contaId: string
  deps: DepsDoCenario
  rodada: RodadaDoCenario
  guardado: Guardado
}

function cenarioDeMemoria(nome: string): CenarioDeConversa {
  const c = cenariosDeMemoria[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

const NOMES = Object.keys(cenariosDeMemoria)

// Roda o cenário e a detecção da conta (que emite o span padroes.deteccao). Os resumos gravados durante o run são espionados.
async function rodarMemoria(nome: string): Promise<Rodado> {
  const c = cenarioDeMemoria(nome)
  const { contaId, deps } = await montarCenario(c)
  const resumoInicial = await deps.stores.routine.resumo(contaId)
  const gravados = vi.spyOn(deps.stores.routine, "gravarResumo")
  const rodada = await rodarCenario(deps, contaId, c)
  await deps.patterns.detectarPadroes()

  const resumosDoRun = await Promise.all(
    gravados.mock.results.flatMap((r) => (r.type === "return" ? [r.value] : [])),
  )
  const resumoFinal = await deps.stores.routine.resumo(contaId)
  const guardado: Guardado = {
    notas: (await deps.stores.routine.notasAtivas(contaId)).map((n) => n.texto),
    resumos: [resumoInicial, ...resumosDoRun, resumoFinal].flatMap((r) => (r ? [r.texto] : [])),
    padroes: (await deps.stores.patterns.listar(contaId)).flatMap((p) => [p.frase, p.chave]),
  }
  return { c, contaId, deps, rodada, guardado }
}

// Todos os valores de telemetria da conta: atributos de span, rótulos de métrica, campos de log e resumos de etapa.
async function valoresDeTelemetria(deps: DepsDoCenario, contaId: string, runIds: string[]) {
  const etapas = (
    await Promise.all(runIds.map((id) => deps.stores.runs.etapas(contaId, id)))
  ).flat()
  return [
    ...deps.telemetry.spans.flatMap((s) => Object.values(s.atributos)),
    ...deps.telemetry.metricas.flatMap((m) => Object.values(m.rotulos)),
    ...deps.telemetry.logs.flatMap((l) => Object.values(l.campos)),
    ...etapas.flatMap((e) => (e.resumo === null ? [] : [e.resumo])),
  ]
    .filter((v): v is string => typeof v === "string")
    .map(norm)
}

function saidaTitulos(rodada: RodadaDoCenario): string[] {
  return [
    ...(rodada.final.saida?.sugestoes ?? []),
    ...(rodada.depois?.final.saida?.sugestoes ?? []),
  ].map((s) => s.titulo)
}

// Nomes e ids da base, títulos (semeados e da saída), mensagens, notas, resumos, frases e chaves são trechos;
// cada palavra longa das mensagens e do que foi guardado vira palavra.
function termosProibidos(r: Rodado): Termos {
  const nomes = kb.alimentos.map((a) => norm(a.nome))
  const ids = kb.alimentos.map((a) => norm(a.id))
  const titulos = [...(r.c.retornos ?? []).map((x) => x.sugestao.titulo), ...saidaTitulos(r.rodada)]
  const mensagens = [r.c.mensagem.texto, r.c.depois?.mensagem.texto].flatMap((t) => (t ? [t] : []))
  const guardados = [...r.guardado.notas, ...r.guardado.resumos, ...r.guardado.padroes]
  return {
    trechos: [
      ...nomes,
      ...ids,
      ...titulos.map(norm),
      ...mensagens.map(norm),
      ...guardados.map(norm),
    ],
    palavras: [...mensagens, ...guardados].flatMap(palavrasLongas),
  }
}

// UUIDs gerados pelos stores em memória são identificadores aleatórios, nunca texto da pessoa; sem tirá-los,
// um termo de quatro letras hexadecimais (como "cafe") casa por acaso dentro de um deles e o eval oscila.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

function vazamentos(entradas: string[], termos: Termos): string[] {
  const valores = entradas.map((v) => v.replace(UUID, "<id>"))
  return [
    ...termos.trechos.filter((t) => valores.some((v) => trechoVaza(v, t))),
    ...termos.palavras.filter((p) => valores.some((v) => tokens(v).includes(p))),
  ]
}

describe("os seis cenários da 012 não vazam nota, resumo, padrão, alimento nem sugestão", () => {
  it("são seis cenários", () => {
    expect(NOMES).toHaveLength(6)
  })

  it.each(NOMES)(
    "%s: nenhum valor de telemetria traz nota, resumo, frase, chave, alimento, título ou mensagem",
    async (nome) => {
      const r = await rodarMemoria(nome)
      const runIds = [r.rodada.final.run_id, r.rodada.depois?.final.run_id].flatMap((id) =>
        id ? [id] : [],
      )

      const valores = await valoresDeTelemetria(r.deps, r.contaId, runIds)

      expect(vazamentos(valores, termosProibidos(r))).toEqual([])
    },
  )
})

// Atributos que cada um desses spans leva (o que o código atribui); qualquer outro é vazamento.
const ATRIBUTOS_DOS_SPANS: Record<string, string[]> = {
  "memoria.resumo": ["resumo.origem"],
  "padroes.deteccao": ["padroes.contas", "padroes.propostos"],
}

describe("os spans memoria.resumo e padroes.deteccao só têm os atributos da lista", () => {
  it("há os dois spans nos seis cenários, e cada um só leva os seus atributos (que estão na lista da telemetria)", async () => {
    const spans = []
    for (const nome of NOMES) {
      const r = await rodarMemoria(nome)
      spans.push(...r.deps.telemetry.spans.filter((s) => s.nome in ATRIBUTOS_DOS_SPANS))
    }

    expect(new Set(spans.map((s) => s.nome))).toEqual(new Set(Object.keys(ATRIBUTOS_DOS_SPANS)))
    for (const s of spans) {
      const permitidos = ATRIBUTOS_DOS_SPANS[s.nome] ?? []
      expect(permitidos.every((k) => PERMITIDOS.has(k))).toBe(true)
      expect(Object.keys(s.atributos).filter((k) => !permitidos.includes(k))).toEqual([])
    }
  })
})

describe("nenhuma linha de rotina_notas, rotina_resumos ou padroes tem palavra de incomodos.yaml", () => {
  it("a base tem palavras de incômodo para conferir", () => {
    expect(kb.incomodos.length).toBeGreaterThan(0)
  })

  it.each(NOMES)("%s: notas, resumos e padrões guardados sem palavra de incômodo", async (nome) => {
    const r = await rodarMemoria(nome)

    expect(r.guardado.notas.filter((t) => contemIncomodo(t, kb))).toEqual([])
    expect(r.guardado.resumos.filter((t) => contemIncomodo(t, kb))).toEqual([])
    expect(r.guardado.padroes.filter((t) => contemIncomodo(t, kb))).toEqual([])
  })
})
