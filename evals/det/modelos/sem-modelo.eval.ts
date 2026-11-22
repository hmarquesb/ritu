import { llmCotas } from "@config/llm-cotas"
import { beforeAll, describe, expect, it } from "vitest"
import { type FiltroPessoa, filtroVazio, passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type Estado, MOMENTOS_DO_DIA, type MomentoDoDia } from "@/core/knowledge/vocab"
import { createModelRouter } from "@/core/llm/router"
import { respostaSemModelo } from "@/core/llm/sem-modelo"
import { TEXTO_COM_ATALHOS, TEXTO_SO_TEXTO } from "@/core/llm/textos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLedger } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

const kb: KnowledgeBase = getContainer().knowledge
const clock = createFixedClock("2026-01-15T12:00:00Z")
const ledger = createMemoryLedger(clock)
const router = createModelRouter({ ledger, clock, telemetry: createMemoryTelemetry() })

// Esgota cada modelo do papel decisão no dia, com os limites da configuração.
beforeAll(async () => {
  for (const modelo of llmCotas.papeis.decisao) {
    for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
      await ledger.registrarRateLimit(modelo)
    }
  }
})

const GRUPOS_EVITAR = kb.gruposEvitar.map((g) => g.id)

const filtroEvitando = (grupo: string): FiltroPessoa => ({
  evitar: [{ tipo: "grupo", valor: grupo }],
  restricoes: [],
  nao_come: [],
  nao_gosta: [],
})

function rotuloDo(estado: Estado): string {
  return (kb.estados.find((e) => e.id === estado)?.rotulo ?? estado).toLowerCase()
}

function praticaValida(praticaId: string, estado: Estado, momento: MomentoDoDia): boolean {
  const pratica = kb.pratica(praticaId)
  if (!pratica) return false
  return (
    pratica.favorece_estados.includes(estado) &&
    !pratica.contraindicacoes.includes(estado) &&
    pratica.momento.includes(momento) &&
    passaNoFiltro(pratica, filtroVazio, kb).passa
  )
}

describe("sem modelo: decisão esgotada no dia", () => {
  it("temModelo(decisao) é false e o fornecedor não tem próximo", async () => {
    expect(await router.temModelo("decisao")).toBe(false)
    expect(await router.paraPapel("decisao").proximo()).toBeNull()
  })
})

function roteadorNovo() {
  const relogio = createFixedClock("2026-01-15T12:00:00Z")
  const registro = createMemoryLedger(relogio)
  const roteador = createModelRouter({
    ledger: registro,
    clock: relogio,
    telemetry: createMemoryTelemetry(),
  })
  return { roteador, registro, relogio }
}

async function gastarDiaDe(
  registro: ReturnType<typeof roteadorNovo>["registro"],
  relogio: ReturnType<typeof roteadorNovo>["relogio"],
  modelo: string,
) {
  const limites = llmCotas.modelos[modelo as keyof typeof llmCotas.modelos]
  let feitos = 0
  while (feitos < limites.rpd) {
    for (let i = 0; i < limites.rpm && feitos < limites.rpd; i++, feitos++) {
      await registro.reservar(modelo, limites)
    }
    relogio.advance(60_000)
  }
}

describe("sem modelo: cota do dia do papel decisão", () => {
  it("cota do minuto cheia em todos os modelos: o dia ainda não está esgotado", async () => {
    const { roteador, registro } = roteadorNovo()
    for (const m of llmCotas.papeis.decisao) {
      const limites = llmCotas.modelos[m]
      for (let i = 0; i < limites.rpm; i++) await registro.reservar(m, limites)
    }
    expect(await roteador.cotaDoDiaEsgotada("decisao")).toBe(false)
  })

  it("cota do dia cheia em todos os modelos: esgotado", async () => {
    const { roteador, registro, relogio } = roteadorNovo()
    for (const m of llmCotas.papeis.decisao) await gastarDiaDe(registro, relogio, m)
    expect(await roteador.cotaDoDiaEsgotada("decisao")).toBe(true)
  })

  it("um modelo do papel ainda livre: não esgotado", async () => {
    const { roteador, registro, relogio } = roteadorNovo()
    for (const m of llmCotas.papeis.decisao.slice(1)) await gastarDiaDe(registro, relogio, m)
    expect(await roteador.cotaDoDiaEsgotada("decisao")).toBe(false)
  })

  it("esgotado_ate dia em todos os modelos: esgotado", async () => {
    const { roteador, registro } = roteadorNovo()
    for (const m of llmCotas.papeis.decisao) {
      for (let i = 0; i < llmCotas.rateLimitsParaEsgotarODia; i++) {
        await registro.registrarRateLimit(m)
      }
    }
    expect(await roteador.cotaDoDiaEsgotada("decisao")).toBe(true)
  })
})

describe("sem modelo: texto e práticas da base real", () => {
  it("sem estado, devolve o texto só de texto e nenhuma prática", () => {
    const r = respostaSemModelo({ estados: [], momento_do_dia: "tarde", filtro: filtroVazio }, kb)
    expect(r).toEqual({ resposta: TEXTO_SO_TEXTO, praticas: [] })
  })

  it.each(kb.estados.map((e) => e.id))(
    "estado %s: texto com o rótulo e práticas válidas para o estado e o momento",
    (estado) => {
      for (const momento of MOMENTOS_DO_DIA) {
        const r = respostaSemModelo(
          { estados: [estado], momento_do_dia: momento, filtro: filtroVazio },
          kb,
        )
        expect(r.resposta).toBe(TEXTO_COM_ATALHOS.replace("{estados}", rotuloDo(estado)))
        expect(r.praticas.length).toBeLessThanOrEqual(3)
        for (const p of r.praticas) {
          expect(praticaValida(p.pratica_id, estado, momento), p.pratica_id).toBe(true)
        }
      }
    },
  )

  it.each(GRUPOS_EVITAR)(
    "evitar %s: nenhuma prática devolvida contém alimento do grupo",
    (grupo) => {
      for (const estado of kb.estados.map((e) => e.id)) {
        const r = respostaSemModelo(
          { estados: [estado], momento_do_dia: "tarde", filtro: filtroEvitando(grupo) },
          kb,
        )
        for (const p of r.praticas) {
          const pratica = kb.pratica(p.pratica_id)
          const aprovada =
            pratica !== undefined && passaNoFiltro(pratica, filtroEvitando(grupo), kb).passa
          expect(aprovada, p.pratica_id).toBe(true)
        }
      }
    },
  )
})
