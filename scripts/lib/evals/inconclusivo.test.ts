import { describe, expect, it } from "vitest"
import { classificarCaso, fecharEstado, sinaisDeErroDoLlm } from "./inconclusivo"

const SEM_SINAIS = {
  etapas: [],
  houveCotaOu429: false,
  validouOk: false,
  chamadasDeDecisao: 0,
}

const ETAPA = { tipo: "decisao", nome: "decisao", status: "ok", resumo: null }

describe("classificarCaso", () => {
  it("erro de conexão com o banco é inconclusivo por banco", () => {
    expect(classificarCaso({ ...SEM_SINAIS, erro: "AggregateError", etapas: [ETAPA] })).toEqual({
      estado: "inconclusivo",
      inconclusivo: "banco",
    })
  })

  it("erro de conexão recusada também é banco, mesmo sem etapas", () => {
    expect(classificarCaso({ ...SEM_SINAIS, erro: "ECONNREFUSED" })).toEqual({
      estado: "inconclusivo",
      inconclusivo: "banco",
    })
  })

  it("erro com etapas anteriores e sem sinal de banco não é inconclusivo", () => {
    expect(classificarCaso({ ...SEM_SINAIS, erro: "TypeError", etapas: [ETAPA] })).toEqual({
      estado: "falhou",
    })
  })

  it("sem etapas e com erro vira sem_etapas", () => {
    expect(classificarCaso({ ...SEM_SINAIS, erro: "TypeError" })).toEqual({
      estado: "inconclusivo",
      inconclusivo: "sem_etapas",
    })
  })

  it("429 visto em alguma chamada do run vira cota, mesmo com etapas", () => {
    expect(
      classificarCaso({ ...SEM_SINAIS, houveCotaOu429: true, etapas: [ETAPA], erro: "x" }),
    ).toEqual({ estado: "inconclusivo", inconclusivo: "cota" })
  })

  it("fim do run por indisponivel vira cota", () => {
    expect(classificarCaso({ ...SEM_SINAIS, fim: "indisponivel", etapas: [ETAPA] })).toEqual({
      estado: "inconclusivo",
      inconclusivo: "cota",
    })
  })

  it("entrega que passou no validador e teve Juiz indisponível vira juiz_indisponivel", () => {
    expect(
      classificarCaso({
        ...SEM_SINAIS,
        validouOk: true,
        juiz: "indisponivel",
        etapas: [ETAPA],
      }),
    ).toEqual({ estado: "inconclusivo", inconclusivo: "juiz_indisponivel" })
  })

  it("juiz indisponível sem entrega validada não é juiz_indisponivel", () => {
    expect(
      classificarCaso({ ...SEM_SINAIS, validouOk: false, juiz: "indisponivel", etapas: [ETAPA] }),
    ).toEqual({ estado: "falhou" })
  })

  it("timeout antes de qualquer decisão concluída vira timeout_sem_decisao", () => {
    expect(
      classificarCaso({
        ...SEM_SINAIS,
        erro: "LlmError:timeout",
        chamadasDeDecisao: 0,
        etapas: [ETAPA],
      }),
    ).toEqual({ estado: "inconclusivo", inconclusivo: "timeout_sem_decisao" })
  })

  it("timeout depois de uma decisão concluída não é inconclusivo", () => {
    expect(
      classificarCaso({
        ...SEM_SINAIS,
        erro: "LlmError:timeout",
        chamadasDeDecisao: 2,
        etapas: [ETAPA],
      }),
    ).toEqual({ estado: "falhou" })
  })

  it("controle: sem erro e sem sinal, o caso é falhou (o fechamento decide o acerto)", () => {
    expect(classificarCaso({ ...SEM_SINAIS, etapas: [ETAPA] })).toEqual({ estado: "falhou" })
  })
})

describe("fecharEstado", () => {
  it("controle: caso sem inconclusivo com checagens certas vira acertou", () => {
    expect(fecharEstado(true, { estado: "falhou" })).toEqual({ estado: "acertou" })
  })

  it("controle: caso sem inconclusivo com violação vira falhou", () => {
    expect(fecharEstado(false, { estado: "falhou" })).toEqual({ estado: "falhou" })
  })

  it("inconclusivo nunca vira acertou, mesmo com as checagens certas", () => {
    const c = { estado: "inconclusivo" as const, inconclusivo: "cota" as const }
    expect(fecharEstado(true, c)).toEqual(c)
  })
})

describe("sinaisDeErroDoLlm", () => {
  it("429 em ritu_llm_erros_total marca houveCotaOu429", () => {
    const sinais = sinaisDeErroDoLlm(
      [
        {
          nome: "ritu_llm_erros_total",
          rotulos: { modelo: "m", papel: "decisao", codigo: "rate_limit" },
        },
      ],
      "done",
    )
    expect(sinais).toEqual({ houveCotaOu429: true, fim: undefined })
  })

  it("indisponível num run que falhou vira fim indisponivel", () => {
    const sinais = sinaisDeErroDoLlm(
      [
        {
          nome: "ritu_llm_erros_total",
          rotulos: { modelo: "m", papel: "decisao", codigo: "indisponivel" },
        },
      ],
      "failed",
    )
    expect(sinais).toEqual({ houveCotaOu429: false, fim: "indisponivel" })
  })

  it("sem erros de LLM e métricas de outro nome, nada é marcado", () => {
    const sinais = sinaisDeErroDoLlm([{ nome: "ritu_llm_chamadas_total", rotulos: {} }], "done")
    expect(sinais).toEqual({ houveCotaOu429: false, fim: undefined })
  })
})
