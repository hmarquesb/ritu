import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { prazosDaPolitica, preencher } from "./prazos"

function textosDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor]
  if (Array.isArray(valor)) return valor.flatMap(textosDe)
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDe)
  return []
}

const valoresCompletos = {
  ...prazosDaPolitica(),
  nome: config.publico.autoria.nome,
  idadeMinima: config.publico.idadeMinima,
  email: "privacidade@ritu.dev",
}

describe("prazosDaPolitica", () => {
  it("lê cada prazo da configuração", () => {
    const prazos = prazosDaPolitica()
    expect(prazos.mensagensDias).toBe(config.memoria.mensagensDias)
    expect(prazos.faltasDias).toBe(config.memoria.faltasDias)
    expect(prazos.retornosDias).toBe(config.memoria.retornosDias)
    expect(prazos.demonstracaoHoras).toBe(config.limites.demo.duracaoHoras)
    expect(prazos.sessaoDias).toBe(config.limites.sessao.dias)
    expect(prazos.temaDias).toBe(config.ui.theme.maxAgeDays)
  })
})

describe("preencher", () => {
  it("troca os marcadores de todos os textos de Sobre com os valores completos", () => {
    for (const texto of textosDe(config.textosSobre)) {
      expect(() => preencher(texto, valoresCompletos)).not.toThrow()
    }
  })

  it("troca o marcador pelo valor", () => {
    expect(preencher("Por {faltasDias} dias.", { faltasDias: 30 })).toBe("Por 30 dias.")
  })

  it("lança texto_sem_valor quando falta o valor de um marcador", () => {
    const erro = (() => {
      try {
        preencher("Por {faltasDias} dias.", {})
      } catch (e) {
        return e
      }
      return null
    })()
    expect(erro).toBeInstanceOf(RituError)
    expect((erro as RituError).code).toBe("texto_sem_valor")
  })
})
