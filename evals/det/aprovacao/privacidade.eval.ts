import { describe, expect, it } from "vitest"
import { normalizar } from "@/core/knowledge/identificar"
import { type ConteudoDaProposta, lerConteudo } from "@/core/proposals/conteudo"
import { getContainer } from "@/infra/container"
import {
  cenariosComAprovacao,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Privacidade com aprovação: nada da pessoa nem da base vai para span, métrica, log ou resumo de etapa.
// Os termos são os da conversa (mensagem inteira, cada palavra de 5 letras ou mais, nome e id de alimento)
// mais o que o bloco mostra: o texto de cada linha e o de cada nota de rotina.

const kb = getContainer().knowledge

// Ids gerados (run, trace, span) são hexadecimais aleatórios: um nome de alimento pode cair dentro deles.
// Sem esses campos, a comparação só vê o que o código escreveu.
const IDS_GERADOS = new Set(["run.id", "trace_id"])
const semIds = (campos: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(campos).filter(([chave]) => !IDS_GERADOS.has(chave)))

function telemetriaDe(t: {
  spans: { nome: string; atributos: Record<string, unknown>; falha?: string }[]
  metricas: { nome: string; valor: number; rotulos: Record<string, unknown> }[]
  logs: { nivel: string; codigo: string; campos: Record<string, unknown> }[]
  eventos: { nome: string; atributos: Record<string, unknown> }[]
}): string {
  return normalizar(
    JSON.stringify({
      spans: t.spans.map((s) => ({ nome: s.nome, atributos: semIds(s.atributos), falha: s.falha })),
      metricas: t.metricas.map((m) => ({ nome: m.nome, valor: m.valor, rotulos: m.rotulos })),
      logs: t.logs.map((l) => ({ nivel: l.nivel, codigo: l.codigo, campos: semIds(l.campos) })),
      eventos: t.eventos.map((e) => ({ nome: e.nome, atributos: semIds(e.atributos) })),
    }),
  )
}

// Os quatro cenários com decisão de bloco (campo `aprovacao`): casa, parcial, faltou hoje e vegetariana.
const QUATRO = ["aprovacao-parcial", "casa-sozinha", "faltou-hoje", "vegetariana"]
const COM_APROVACAO = Object.entries({ ...cenariosDeConversa, ...cenariosComAprovacao }).filter(
  ([, c]) => c.aprovacao !== undefined,
)

// Resumos que podem sair das etapas: só tipo e contagem (D13), nunca texto da pessoa ou da base.
const RESUMO_PROPOSTA =
  /^(casa|evitar_sempre|restricao|nao_come|gosta): \d+ (item|itens)$|^(rotina|lista)$/
const RESUMO_APROVACAO = /^\d+ de \d+$/
const RESUMO_DA_TOOL = /^(proposto|recusado: [a-z_]+)$/

function idsDoConteudo(c: ConteudoDaProposta): string[] {
  if (c.tool === "lista.propor") return [c.alimento_id]
  if (c.tool === "memoria.propor" && c.tipo === "gosta") return c.itens.map((i) => i.alimento_id)
  if (c.tool === "memoria.propor" && c.tipo === "evitar_sempre") {
    return c.itens.flatMap((i) => (i.tipo === "alimento" ? [i.valor] : []))
  }
  if (c.tool === "casa.propor" || (c.tool === "memoria.propor" && c.tipo === "nao_come")) {
    return c.itens.flatMap((i) => (i.alimento_id ? [i.alimento_id] : []))
  }
  return []
}

function termosDaPessoa(c: CenarioDeConversa): string[] {
  const textos = [c.mensagem.texto, c.depois?.mensagem.texto].flatMap((t) => (t ? [t] : []))
  return textos.flatMap((t) => {
    const todo = normalizar(t)
    const palavras = todo.split(" ").filter((p) => p.length >= 5)
    return [todo, ...palavras]
  })
}

async function termosDoBloco(
  deps: DepsDoCenario,
  contaId: string,
  runIds: string[],
  textosDasLinhas: string[],
): Promise<string[]> {
  const conteudos: ConteudoDaProposta[] = []
  for (const runId of runIds) {
    for (const p of await deps.stores.proposals.doRun(contaId, runId)) {
      const c = lerConteudo(p.tool, p.conteudo)
      if (c) conteudos.push(c)
    }
  }
  const notas = conteudos.flatMap((c) =>
    c.tool === "memoria.propor" && c.tipo === "rotina" ? [c.texto] : [],
  )
  const ids = conteudos.flatMap(idsDoConteudo)
  return [...notas, ...ids, ...textosDasLinhas].map(normalizar)
}

function termosDaBase(): string[] {
  return kb.alimentos.map((a) => normalizar(a.nome))
}

// Roda o cenário até o fim, com a decisão do próprio cenário ou aprovando todas as linhas.
async function rodar(c: CenarioDeConversa, aprovarTudo: boolean) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(
    deps,
    contaId,
    c,
    aprovarTudo ? { decidir: async (propostas) => propostas.map((p) => p.id) } : {},
  )
  const runIds = [rodada.final.run_id, rodada.depois?.final.run_id].flatMap((id) =>
    id ? [id] : [],
  )
  const textosDasLinhas = [
    ...(rodada.final.saida?.propostas ?? []),
    ...(rodada.depois?.final.saida?.propostas ?? []),
  ].map((p) => p.texto)
  return { contaId, deps, rodada, runIds, textosDasLinhas }
}

async function verificar(nome: string, c: CenarioDeConversa, aprovarTudo: boolean) {
  const { contaId, deps, runIds, textosDasLinhas } = await rodar(c, aprovarTudo)

  // Controle: a aprovação de fato rodou e chegou a gravar linhas (senão o teste não diz nada do bloco).
  expect(deps.telemetry.spans.some((s) => s.nome === "aprovacao.execucao")).toBe(true)
  expect(deps.telemetry.metricas.some((m) => m.nome === "ritu_propostas_total")).toBe(true)

  const etapas = (
    await Promise.all(runIds.map((id) => deps.stores.runs.etapas(contaId, id)))
  ).flat()
  const propostas = etapas.filter((e) => e.tipo === "proposta")
  expect(propostas.length, `${nome} · etapas proposta`).toBeGreaterThan(0)
  for (const e of propostas) expect(e.resumo, `${nome} · resumo proposta`).toMatch(RESUMO_PROPOSTA)
  for (const e of etapas.filter((x) => x.tipo === "aprovacao")) {
    expect(e.resumo, `${nome} · resumo aprovação`).toMatch(RESUMO_APROVACAO)
  }
  for (const e of etapas.filter((x) => x.tipo === "tool" && x.nome.endsWith(".propor"))) {
    expect(e.resumo, `${nome} · resumo da tool ${e.nome}`).toMatch(RESUMO_DA_TOOL)
  }

  const termos = [
    ...new Set(
      [
        ...termosDaPessoa(c),
        ...termosDaBase(),
        ...(await termosDoBloco(deps, contaId, runIds, textosDasLinhas)),
      ].filter((t) => t !== ""),
    ),
  ]
  const telemetria = telemetriaDe(deps.telemetry)
  const resumos = normalizar(etapas.map((e) => e.resumo ?? "").join(" | "))

  expect(termos.length).toBeGreaterThan(0)
  for (const termo of termos) {
    expect(telemetria, `${nome} · telemetria · "${termo}"`).not.toContain(termo)
    expect(resumos, `${nome} · resumo de etapa · "${termo}"`).not.toContain(termo)
  }
}

describe("privacidade do bloco: os cenários com aprovação", () => {
  it("são os quatro esperados", () => {
    expect(COM_APROVACAO.map(([nome]) => nome).sort()).toEqual([...QUATRO].sort())
  })

  it.each(COM_APROVACAO)("%s: com a decisão do cenário", async (nome, c) => {
    await verificar(nome, c, false)
  })

  it.each(COM_APROVACAO)("%s: aprovando todas as linhas", async (nome, c) => {
    await verificar(nome, c, true)
  })
})
