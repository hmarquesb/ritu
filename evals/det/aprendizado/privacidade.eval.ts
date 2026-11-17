import { describe, expect, it } from "vitest"
import { getContainer } from "@/infra/container"
import {
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Privacidade da 011: nome e id de alimento, título de sugestão e texto da pessoa não vão para span, métrica,
// log nem resumo de etapa. O span toque só leva tipo, motivo e resultado.

const kb = getContainer().knowledge

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

// Palavras de 5 letras ou mais da mensagem (sem acento), como a privacidade manda conferir.
function palavrasLongas(texto: string): string[] {
  return texto
    .split(/[^\p{L}]+/u)
    .map(norm)
    .filter((p) => p.length >= 5)
}

// Trecho de nome, id ou título: vaza se estiver no valor; nome de 3 letras ou menos só casa o valor inteiro.
const trechoVaza = (valor: string, trecho: string) =>
  trecho.length <= 3 ? valor === trecho : valor.includes(trecho)

// Palavra da pessoa vaza só como token inteiro: "tenho" não casa com o motivo "nao_tenho" (enum fechado).
const tokens = (valor: string) => valor.split(/[^\p{L}_-]+/u).filter(Boolean)

type Termos = { trechos: string[]; palavras: string[] }

// Nomes e ids da base, títulos (semeados e da saída) e a mensagem inteira são trechos; cada palavra longa, palavra.
function termosProibidos(c: CenarioDeConversa, titulosDaSaida: string[]): Termos {
  const nomes = kb.alimentos.map((a) => norm(a.nome))
  const ids = kb.alimentos.map((a) => norm(a.id))
  const titulos = [...(c.retornos ?? []).map((r) => r.sugestao.titulo), ...titulosDaSaida]
  const mensagens = [c.mensagem.texto, c.depois?.mensagem.texto].flatMap((t) => (t ? [t] : []))
  return {
    trechos: [...nomes, ...ids, ...titulos.map(norm), ...mensagens.map(norm)],
    palavras: mensagens.flatMap(palavrasLongas),
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

function cenarioDeAprendizado(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

const NOMES = Object.keys(cenariosDeAprendizado)

describe("os seis cenários da 011 não vazam texto da pessoa, alimento nem sugestão", () => {
  it("são seis cenários", () => {
    expect(NOMES).toHaveLength(6)
  })

  it.each(NOMES)(
    "%s: nenhum valor de telemetria traz alimento, título ou mensagem",
    async (nome) => {
      const c = cenarioDeAprendizado(nome)
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

describe("o span toque só leva tipo, motivo e resultado", () => {
  const COM_TOQUE = NOMES.filter((nome) => (cenariosDeAprendizado[nome]?.toques ?? []).length > 0)

  it("há toques nos cenários da 011, e cada span toque tem só essas chaves", async () => {
    const chaves: string[][] = []
    for (const nome of COM_TOQUE) {
      const c = cenarioDeAprendizado(nome)
      const { contaId, deps } = await montarCenario(c)
      await rodarCenario(deps, contaId, c)
      for (const s of deps.telemetry.spans.filter((x) => x.nome === "toque")) {
        chaves.push(Object.keys(s.atributos))
      }
    }

    expect(chaves.length).toBeGreaterThan(0)
    for (const k of chaves) {
      expect(k.every((chave) => ["tipo", "motivo", "resultado"].includes(chave))).toBe(true)
    }
  })
})
