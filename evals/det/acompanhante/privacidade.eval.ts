import { describe, expect, it } from "vitest"
import { getContainer } from "@/infra/container"
import { type Cenario, cenarios, montarCenario } from "../../../test/fixtures/cenarios"

type Execucao = {
  entrada: string
  resposta: string
  emitido: string
  spans: number
}

// Remove acento e caixa, para comparar texto com texto.
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// Todas as strings de um valor, em qualquer profundidade.
function textosDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor]
  if (Array.isArray(valor)) return valor.flatMap(textosDe)
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDe)
  return []
}

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Nome de alimento como palavra inteira (ou expressão inteira) no texto emitido.
function nomesVazados(emitido: string, nomes: string[]): string[] {
  return nomes.filter((nome) =>
    new RegExp(`(^|[^a-z0-9])${escapar(nome)}($|[^a-z0-9])`).test(emitido),
  )
}

function cenario(nome: string): Cenario {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

const NOMES_DA_BASE = [
  ...new Set(getContainer().knowledge.alimentos.map((a) => normalizar(a.nome))),
]

// Roda cada cenário uma vez e reúne tudo o que sai para fora: spans, eventos, métricas, logs e resumos.
const cache = new Map<string, Execucao>()

async function execucao(nome: string): Promise<Execucao> {
  const enviada = cache.get(nome)
  if (enviada) return enviada
  const c = cenario(nome)
  const { contaId, deps } = await montarCenario(c)
  const r = await deps.companion.responder(contaId, c.entrada)
  const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
  const { spans, eventos, metricas, logs } = deps.telemetry
  const resumos = etapas.map((e) => e.resumo)
  const textoDaEntrada = c.entrada.texto
  if (!textoDaEntrada) throw new Error(`cenário sem texto na entrada: ${nome}`)
  const pronta: Execucao = {
    entrada: normalizar(textoDaEntrada),
    resposta: normalizar(r.saida?.resposta ?? ""),
    emitido: normalizar(textosDe([spans, eventos, metricas, logs, resumos]).join("\n")),
    spans: spans.length,
  }
  cache.set(nome, pronta)
  return pronta
}

const NOMES_DOS_CENARIOS = Object.keys(cenarios)

describe("privacidade: a telemetria dos cenários", () => {
  it.each(NOMES_DOS_CENARIOS)(
    "%s: a telemetria tem spans, sem o que isso prova nada",
    async (nome) => {
      const { spans } = await execucao(nome)
      expect(spans).toBeGreaterThan(0)
    },
  )

  it.each(NOMES_DOS_CENARIOS)(
    "%s: o texto da entrada não aparece em span, métrica, log ou resumo",
    async (nome) => {
      const { entrada, emitido } = await execucao(nome)
      expect(emitido.includes(entrada)).toBe(false)
    },
  )

  it.each(NOMES_DOS_CENARIOS)(
    "%s: o texto da resposta não aparece em span, métrica, log ou resumo",
    async (nome) => {
      const { resposta, emitido } = await execucao(nome)
      expect(emitido.includes(resposta)).toBe(false)
    },
  )

  it.each(NOMES_DOS_CENARIOS)(
    "%s: nenhum nome de alimento da base real aparece em span, métrica, log ou resumo",
    async (nome) => {
      const { emitido } = await execucao(nome)
      expect(nomesVazados(emitido, NOMES_DA_BASE)).toEqual([])
    },
  )
})
