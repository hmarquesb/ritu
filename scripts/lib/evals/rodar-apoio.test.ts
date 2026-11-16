import { describe, expect, it } from "vitest"
import type { CasoInterprete } from "../../../evals/llm/casos/c2"
import type { CasoJuiz, CasoMemoria } from "../../../evals/llm/casos/c3"
import type { SaidaDoAcompanhante } from "../../../src/core/agents/companion/saida"
import { createFakeLlm } from "../../../src/infra/fakes/fake-llm"
import { createFixedClock } from "../../../src/infra/fakes/fixed-clock"
import { createMiniKnowledge } from "../../../src/infra/fakes/mini-knowledge"
import { rodarInterprete, rodarJuiz, rodarMemoria } from "./rodar-apoio"

const AGORA = "2026-06-15T22:00:00.000Z"

const kb = createMiniKnowledge()

const saidaDoInterprete = {
  intencoes: ["momento"],
  estados: ["com_frio"],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

const casoInterprete: CasoInterprete = {
  tipo: "interprete",
  familias: ["intencao"],
  id: "t-interprete",
  titulo: "Frio na mensagem",
  mensagem: "Estou com frio",
  deve: [
    {
      descricao: "entende o frio",
      confere: (r) => r.interpretacao.estados.includes("com_frio"),
    },
  ],
  naoPode: [
    {
      descricao: "não vai para fora",
      confere: (r) => r.caminho !== "fora",
    },
  ],
}

const saidaDoJuiz: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "Um prato morno, sem tela.",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
}

const casoJuiz: CasoJuiz = {
  tipo: "juiz",
  familias: ["juiz"],
  id: "t-juiz",
  titulo: "Promessa de cura",
  saida: { ...saidaDoJuiz, resposta: "Isso cura a dor." },
  evitar: [],
  motivos: ["promessa"],
  deve: [
    {
      descricao: "aponta a promessa",
      confere: (v) => v.ok && v.graves.includes("promessa"),
    },
  ],
  naoPode: [
    {
      descricao: "não aprova",
      confere: (v) => !(v.ok && v.aprovado),
    },
  ],
}

const casoMemoria: CasoMemoria = {
  tipo: "memoria",
  familias: ["memoria"],
  id: "t-memoria",
  titulo: "Notas repetidas viram uma frase",
  notas: [
    { texto: "almoço fora na semana", diasAtras: 10 },
    { texto: "almoço fora de segunda a sexta", diasAtras: 3 },
  ],
  deve: [
    {
      descricao: "junta as repetidas",
      confere: ({ resumo }) => resumo.texto.includes("fora"),
    },
  ],
  naoPode: [
    {
      descricao: "não inventa diagnóstico",
      confere: ({ resumo }) => !resumo.texto.includes("diagnóstico"),
    },
  ],
}

describe("runner do Intérprete com LLM falso", () => {
  it("confere a interpretação e o caminho, e devolve o caso com a chamada do apoio", async () => {
    const llm = createFakeLlm([saidaDoInterprete])

    const { resultado, colhido } = await rodarInterprete(casoInterprete, {
      client: llm,
      kb,
      clock: createFixedClock(AGORA),
    })

    expect(resultado.tipo).toBe("interprete")
    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens).toEqual([
      { lista: "deve", descricao: "entende o frio", ok: true },
      { lista: "nao_pode", descricao: "não vai para fora", ok: true },
    ])
    expect(resultado.acertou).toBe(true)
    expect(resultado.uso.apoio?.chamadas).toBe(1)
    expect(resultado.familias).toEqual(["intencao"])
    expect(resultado.marcas).toEqual([])
    expect(colhido.mensagem).toBe("Estou com frio")
    expect(colhido.texto).toBe("")
  })

  it("Intérprete sem o registro de uso do container: roda só com client, kb e clock", async () => {
    const llm = createFakeLlm([saidaDoInterprete])

    const { resultado } = await rodarInterprete(casoInterprete, {
      client: llm,
      kb,
      clock: createFixedClock(AGORA),
    })

    expect(resultado.uso.apoio?.chamadas).toBe(1)
    expect(resultado.trocas).toBe(0)
  })

  it("Intérprete sem resposta conta como caso falho com o motivo", async () => {
    const llm = createFakeLlm([{ erro: "timeout" }])

    const { resultado } = await rodarInterprete(casoInterprete, {
      client: llm,
      kb,
      clock: createFixedClock(AGORA),
    })

    expect(resultado.erro).toBe("erro")
    expect(resultado.acertou).toBe(false)
    expect(resultado.checagens.every((c) => c.ok === false)).toBe(true)
  })
})

describe("runner do Juiz com LLM falso", () => {
  const clock = createFixedClock(AGORA)

  it("confere deve e naoPode sobre o veredito, e grava os motivos esperados e devolvidos", async () => {
    const llm = createFakeLlm([
      { apontamentos: [{ motivo: "promessa", trecho: "Isso cura a dor." }] },
    ])

    const { resultado, colhido } = await rodarJuiz(casoJuiz, { client: llm, kb, clock })

    expect(resultado.tipo).toBe("juiz")
    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens).toEqual([
      { lista: "deve", descricao: "aponta a promessa", ok: true },
      { lista: "nao_pode", descricao: "não aprova", ok: true },
    ])
    expect(resultado.juiz).toEqual({
      esperados: ["promessa"],
      devolvidos: ["promessa"],
      aprovado: false,
    })
    expect(resultado.uso.apoio?.chamadas).toBe(1)
    expect(colhido.texto).toBe("Isso cura a dor.")
    expect(colhido.saida).toEqual(casoJuiz.saida)
  })

  it("resposta sem apontamento conta como aprovada", async () => {
    const llm = createFakeLlm([{ apontamentos: [] }])

    const { resultado } = await rodarJuiz(
      { ...casoJuiz, motivos: [], deve: [], naoPode: [] },
      { client: llm, kb, clock },
    )

    expect(resultado.juiz).toEqual({ esperados: [], devolvidos: [], aprovado: true })
  })

  it("Juiz sem resposta conta como caso falho com o motivo, e as checagens falham", async () => {
    const llm = createFakeLlm([{ erro: "indisponivel" }])

    const { resultado } = await rodarJuiz(casoJuiz, { client: llm, kb, clock })

    expect(resultado.erro).toBeDefined()
    expect(resultado.checagens.every((c) => c.ok === false)).toBe(true)
    expect(resultado.acertou).toBe(false)
  })
})

describe("runner da Memória com LLM falso", () => {
  it("roda o resumo pelo agente, confere deve e naoPode e grava o uso do apoio", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora durante a semana." }])

    const { resultado, colhido } = await rodarMemoria(casoMemoria, {
      client: llm,
      kb,
      clock: createFixedClock(AGORA),
    })

    expect(resultado.tipo).toBe("memoria")
    expect(resultado.erro).toBeUndefined()
    expect(resultado.checagens).toEqual([
      { lista: "deve", descricao: "junta as repetidas", ok: true },
      { lista: "nao_pode", descricao: "não inventa diagnóstico", ok: true },
    ])
    expect(resultado.uso.apoio).toEqual({ chamadas: 1, tokens_entrada: 10, tokens_saida: 5 })
    expect(resultado.modelos).toHaveLength(1)
    expect(colhido.texto).toBe("Você almoça fora durante a semana.")
    expect(colhido.mensagem).toBeUndefined()
  })

  it("o caso com juiz não ganha checagem extra: o critério do juiz é do avaliador", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])

    const { resultado } = await rodarMemoria(
      { ...casoMemoria },
      { client: llm, kb, clock: createFixedClock(AGORA) },
    )

    expect(resultado.checagens).toHaveLength(2)
    expect(resultado.juiz).toBeUndefined()
  })

  it("as notas entram com o dia calculado pelo relógio: agora menos os dias atrás", async () => {
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])

    await rodarMemoria(casoMemoria, { client: llm, kb, clock: createFixedClock(AGORA) })

    const [pedido] = llm.pedidos as { entrada: string }[]
    expect(pedido?.entrada).toContain("1. (2026-06-05) almoço fora na semana")
    expect(pedido?.entrada).toContain("2. (2026-06-12) almoço fora de segunda a sexta")
  })
})
