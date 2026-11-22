import { describe, expect, it } from "vitest"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeGuardrails,
  cenariosDeMemoria,
} from "./index"
import { montarCenario } from "./montar"
import { rodarCenario } from "./rodar"
import { RotaFalhouError, rodarCenarioPelasRotas } from "./rotas"
import type { Cenario } from "./tipos"

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g

// Troca uuids (pela ordem em que aparecem) e datas ISO por marcadores estáveis.
function normalizar(valor: unknown): unknown {
  const ids = new Map<string, string>()
  const texto = JSON.stringify(valor)
    .replace(UUID, (id) => {
      if (!ids.has(id)) ids.set(id, `<id-${ids.size}>`)
      return ids.get(id) ?? id
    })
    .replace(ISO, "<data>")
  return JSON.parse(texto)
}

function comparaveis(r: Awaited<ReturnType<typeof rodarCenario>>): unknown {
  const { final, perguntas, bloco, toques, depois } = r
  return normalizar({ final, perguntas, bloco, toques, depois })
}

const registros: Record<string, Record<string, Cenario>> = {
  conversa: cenariosDeConversa,
  pausa: cenariosComPausa,
  aprovacao: cenariosComAprovacao,
  aprendizado: cenariosDeAprendizado,
  memoria: cenariosDeMemoria,
  guardrails: cenariosDeGuardrails,
}

describe("rodarCenarioPelasRotas: equivalência com rodarCenario", () => {
  for (const [grupo, cenarios] of Object.entries(registros)) {
    for (const [nome, c] of Object.entries(cenarios)) {
      it(`${grupo}/${nome}`, async () => {
        const direta = await montarCenario(c)
        const esperado = await rodarCenario(direta.deps, direta.contaId, c)
        const pelasRotas = await montarCenario(c)
        const obtido = await rodarCenarioPelasRotas(pelasRotas.deps, pelasRotas.contaId, c)

        expect(comparaveis(obtido)).toEqual(comparaveis(esperado))
        expect(obtido.passos.length).toBeGreaterThan(0)
        for (const passo of obtido.passos) {
          expect(passo.status).toBe(200)
          expect(passo.erroDeSchema).toBeUndefined()
          if (passo.eventos) {
            expect(passo.eventos[0]?.tipo).toBe("inicio")
            expect(passo.eventos.at(-1)?.tipo).toBe("fim")
          }
        }
      })
    }
  }
})

describe("rodarCenarioPelasRotas: rota que falha", () => {
  const c = cenariosDeConversa["casa-sozinha"]
  if (!c) throw new Error("cenário ausente: casa-sozinha")

  it("teto baixo responde 429 e a rodada lança RotaFalhouError", async () => {
    const { contaId, deps } = await montarCenario(c)
    const erro = await rodarCenarioPelasRotas(deps, contaId, c, { teto: 1 }).catch((e) => e)
    // O teto de 1 pode deixar a primeira passar; sem 429 na primeira, o cenário não esgotou o teto.
    if (!(erro instanceof RotaFalhouError)) {
      const { contaId: outra, deps: d2 } = await montarCenario(c)
      const segundo = await rodarCenarioPelasRotas(d2, outra, c, { teto: 0 }).catch((e) => e)
      expect(segundo).toBeInstanceOf(RotaFalhouError)
      expect((segundo as RotaFalhouError).passos.at(-1)?.status).toBe(429)
      return
    }
    expect(erro.passos.at(-1)?.status).toBe(429)
  })

  it("run aberto antes da segunda mensagem vira RotaFalhouError com o status do passo", async () => {
    const base = cenariosComAprovacao.vegetariana
    if (!base?.depois) throw new Error("cenário com depois ausente")
    // Sem decidir o bloco, o run da primeira mensagem segue aberto (waiting_for_approval).
    const sem: Cenario = { ...base, aprovacao: undefined }
    const { contaId, deps } = await montarCenario(sem)
    const erro = await rodarCenarioPelasRotas(deps, contaId, sem).catch((e) => e)
    expect(erro).toBeInstanceOf(RotaFalhouError)
    const passo = (erro as RotaFalhouError).passos.at(-1)
    expect(passo?.rota).toBe("POST /api/runs")
    expect(passo?.status).toBe(409)
  })
})
