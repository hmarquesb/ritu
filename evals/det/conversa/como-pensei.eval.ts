import { describe, expect, it } from "vitest"
import { lerComoPensei } from "@/core/como-pensei/ler"
import type { LinhaDoTempo } from "@/core/como-pensei/linha-do-tempo"
import { normalizar } from "@/core/knowledge/identificar"
import type { RunEtapa } from "@/core/runs/ports"
import { getContainer } from "@/infra/container"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
  cenariosDeMemoria,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Como pensei: os cenários da 008 a 013, rodados com o runtime roteirizado, viram linhas do tempo sem passo vazio,
// com `fim` por último; nenhuma frase é o `resumo` cru de uma etapa; nenhum `resumo` de validação tem nome de alimento.
// O relógio é o do cenário, então a hora e o dia da linha não mudam.

const kb = getContainer().knowledge
const FUSO = "America/Sao_Paulo"

// Os registros da 008 a 013 (conversa, pausa, aprovação, aprendizado, memória e guardrails).
const REGISTROS: Record<string, CenarioDeConversa>[] = [
  cenariosDeConversa,
  cenariosComPausa,
  cenariosComAprovacao,
  cenariosDeAprendizado,
  cenariosDeMemoria,
  cenariosDeGuardrails,
]

type Rodado = { nome: string; linhas: { linha: LinhaDoTempo | undefined; etapas: RunEtapa[] }[] }

const FLUXOS = new Map<string, CenarioDeConversa>()
for (const registro of REGISTROS) {
  for (const [nome, c] of Object.entries(registro)) {
    if (FLUXOS.has(nome)) throw new Error(`cenário com nome repetido: ${nome}`)
    FLUXOS.set(nome, c)
  }
}

const cache = new Map<string, Promise<Rodado>>()

// Roda o cenário e lê a linha do tempo de cada run da conta, com as etapas dele para conferir o texto cru.
function rodar(nome: string): Promise<Rodado> {
  let pronto = cache.get(nome)
  if (!pronto) {
    const c = FLUXOS.get(nome)
    if (!c) throw new Error(`cenário ausente: ${nome}`)
    pronto = (async () => {
      const { contaId, deps } = await montarCenario(c)
      await rodarCenario(deps, contaId, c)
      const runs = await deps.stores.runs.recentes(contaId, new Date(0), 50)
      const linhas = []
      for (const run of runs) {
        const linha = await lerComoPensei(
          { stores: deps.stores, kb, clock: deps.clock },
          contaId,
          run.id,
          FUSO,
        )
        linhas.push({ linha, etapas: await deps.stores.runs.etapas(contaId, run.id) })
      }
      return { nome, linhas }
    })()
    cache.set(nome, pronto)
  }
  return pronto
}

const NOMES = [...FLUXOS.keys()]

// Nome de alimento da base como palavra inteira no texto.
const NOMES_DA_BASE = [...new Set(kb.alimentos.map((a) => normalizar(a.nome)))]
const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
function alimentosNo(texto: string): string[] {
  const alvo = normalizar(texto)
  return NOMES_DA_BASE.filter((nome) =>
    new RegExp(`(^|[^a-z0-9])${escapar(nome)}($|[^a-z0-9])`).test(alvo),
  )
}

describe("como pensei: linhas do tempo dos cenários 008 a 013", () => {
  it("há pelo menos uma linha pronta entre os cenários, senão o eval não prova nada", async () => {
    const todas = await Promise.all(NOMES.map(rodar))
    const prontas = todas.flatMap((r) => r.linhas).filter((l) => l.linha?.estado === "pronto")
    expect(prontas.length).toBeGreaterThan(0)
  }, 180_000)

  it.each(NOMES)("%s: toda linha pronta tem passos com frase e termina em fim", async (nome) => {
    const { linhas } = await rodar(nome)
    for (const { linha } of linhas) {
      if (linha?.estado !== "pronto") continue
      expect(linha.passos.filter((p) => p.frase.trim() === "")).toEqual([])
      expect(linha.passos.at(-1)?.tipo).toBe("fim")
    }
  })

  it.each(NOMES)("%s: nenhuma frase é o resumo cru de uma etapa", async (nome) => {
    const { linhas } = await rodar(nome)
    for (const { linha, etapas } of linhas) {
      if (linha?.estado !== "pronto") continue
      const crus = new Set(etapas.flatMap((e) => (e.resumo ? [e.resumo] : [])))
      const iguais = linha.passos.filter((p) => crus.has(p.frase)).map((p) => p.frase)
      expect(iguais).toEqual([])
    }
  })

  it.each(NOMES)("%s: nenhum resumo de validação tem nome de alimento", async (nome) => {
    const { linhas } = await rodar(nome)
    const comNome = linhas.flatMap(({ etapas }) =>
      etapas
        .filter((e) => e.tipo === "validacao" && e.resumo)
        .flatMap((e) => alimentosNo(e.resumo ?? "")),
    )
    expect(comNome).toEqual([])
  })
})
