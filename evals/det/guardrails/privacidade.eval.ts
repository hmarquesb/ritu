import { describe, expect, it } from "vitest"
import { getContainer } from "@/infra/container"
import {
  cenariosDeGuardrails,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Privacidade da 013 (T16), no molde de evals/det/aprendizado/privacidade.eval.ts: texto da pessoa, trecho
// apontado pelo Juiz e nome ou id de alimento da base não vão para span, rótulo de métrica, campo de log
// nem resumo de etapa. Os spans guardrail.entrada e juiz só levam os atributos da sua lista.

const kb = getContainer().knowledge

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

// Palavras de 5 letras ou mais da mensagem (sem acento), como a privacidade manda conferir.
function palavrasLongas(texto: string): string[] {
  return texto
    .split(/[^\p{L}]+/u)
    .map(norm)
    .filter((p) => p.length >= 5)
}

// Trecho de nome, id, título ou apontamento: vaza se estiver no valor; até 3 letras só casa o valor inteiro.
const trechoVaza = (valor: string, trecho: string) =>
  trecho.length <= 3 ? valor === trecho : valor.includes(trecho)

// Palavra da pessoa vaza só como token inteiro: "tenho" não casa com o motivo "nao_tenho" (enum fechado).
// O ponto não separa: "clima.agora" é nome de tool, e "agora" da mensagem não pode casar com ele.
const tokens = (valor: string) => valor.split(/[\s,;:|()"'!?[\]{}]+/u).filter(Boolean)

type Termos = { trechos: string[]; palavras: string[] }

// Nomes e ids da base, títulos, trechos apontados pelo Juiz e a mensagem inteira são trechos; cada palavra longa, palavra.
function termosProibidos(c: CenarioDeConversa, titulosDaSaida: string[]): Termos {
  const nomes = kb.alimentos.map((a) => norm(a.nome))
  const ids = kb.alimentos.map((a) => norm(a.id))
  const titulos = [...(c.retornos ?? []).map((r) => r.sugestao.titulo), ...titulosDaSaida]
  const trechos = (c.juiz ?? []).flatMap((j) =>
    j === "sem_modelo" ? [] : j.apontamentos.map((a) => a.trecho),
  )
  const mensagens = [c.mensagem.texto, c.depois?.mensagem.texto].flatMap((t) => (t ? [t] : []))
  return {
    trechos: [...nomes, ...ids, ...titulos.map(norm), ...trechos.map(norm), ...mensagens.map(norm)],
    palavras: mensagens.flatMap(palavrasLongas),
  }
}

function vazamentos(valores: string[], termos: Termos): string[] {
  return [
    ...termos.trechos.filter((t) => valores.some((v) => trechoVaza(v, t))),
    ...termos.palavras.filter((p) => valores.some((v) => tokens(v).includes(p))),
  ]
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

function cenarioDeGuardrail(nome: string): CenarioDeConversa {
  const c = cenariosDeGuardrails[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

const NOMES = Object.keys(cenariosDeGuardrails)

// Atributos que cada span de guardrail e de Juiz pode levar; qualquer outro é vazamento.
const ATRIBUTOS_DO_SPAN: Record<string, string[]> = {
  "guardrail.entrada": ["guardrail.resultado"],
  juiz: ["juiz.tentativa", "juiz.aprovado"],
}

describe("os sete cenários da 013 não vazam texto da pessoa, trecho apontado nem alimento", () => {
  it("são sete cenários", () => {
    expect(NOMES).toHaveLength(7)
  })

  it.each(NOMES)(
    "%s: nenhum valor de telemetria traz alimento, título, trecho ou mensagem",
    async (nome) => {
      const c = cenarioDeGuardrail(nome)
      const { contaId, deps } = await montarCenario(c)
      const rodada = await rodarCenario(deps, contaId, c)
      const runIds = [rodada.final.run_id, rodada.depois?.final.run_id].flatMap((id) =>
        id ? [id] : [],
      )
      const titulosDaSaida = [
        ...(rodada.final.saida?.sugestoes ?? []),
        ...(rodada.depois?.final.saida?.sugestoes ?? []),
      ].map((s) => s.titulo)

      const valores = await valoresDeTelemetria(deps, contaId, runIds)
      const termos = termosProibidos(c, titulosDaSaida)

      expect(vazamentos(valores, termos)).toEqual([])
    },
  )
})

describe("os spans guardrail.entrada e juiz só têm os atributos da lista", () => {
  it.each(NOMES)("%s: cada span tem só as chaves permitidas para o seu nome", async (nome) => {
    const c = cenarioDeGuardrail(nome)
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    const spans = deps.telemetry.spans.filter((s) => s.nome in ATRIBUTOS_DO_SPAN)

    expect(spans.length).toBeGreaterThan(0)
    for (const s of spans) {
      const permitidas = ATRIBUTOS_DO_SPAN[s.nome] ?? []
      for (const chave of Object.keys(s.atributos)) {
        expect(permitidas).toContain(chave)
      }
    }
  })
})
