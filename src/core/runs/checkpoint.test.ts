import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { lerCheckpoint } from "./checkpoint"

function base(extra: Record<string, unknown> = {}) {
  return {
    versao: 1,
    agente: "ritu",
    prompt_versao: "v1",
    mensagens: [],
    chamadas_de_modelo: 0,
    tokens: { entrada: 0, saida: 0 },
    entregas_recusadas: 0,
    pausas: 0,
    ativo_ms: 0,
    dados: null,
    ...extra,
  }
}

const mensagensValidas = [
  { papel: "pessoa", conteudo: "oi" },
  { papel: "agente", texto: "olá", chamadas: [{ id: "c1", nome: "clima.ler", argumentos: {} }] },
  { papel: "tool", chamada_id: "c1", nome: "clima.ler", resultado: { ok: true } },
  { papel: "sistema", conteudo: "lembrete" },
]

describe("lerCheckpoint", () => {
  it("aceita um checkpoint válido com as quatro formas de mensagem", () => {
    const estado = lerCheckpoint(base({ mensagens: mensagensValidas }))

    expect(estado.versao).toBe(1)
    expect(estado.mensagens).toHaveLength(4)
  })

  it("recusa a versão 2", () => {
    expect(() => lerCheckpoint(base({ versao: 2 }))).toThrow(RituError)
  })

  it("recusa papel desconhecido com código checkpoint_invalido", () => {
    const erro = capturarErro(() =>
      lerCheckpoint(base({ mensagens: [{ papel: "robo", conteudo: "x" }] })),
    )

    expect(erro).toBeInstanceOf(RituError)
    expect(erro?.code).toBe("checkpoint_invalido")
  })

  it("recusa chamadas de modelo negativas", () => {
    expect(() => lerCheckpoint(base({ chamadas_de_modelo: -1 }))).toThrow(RituError)
  })
})

function capturarErro(fn: () => unknown): RituError | undefined {
  try {
    fn()
  } catch (erro) {
    return erro as RituError
  }
  return undefined
}
