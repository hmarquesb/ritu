import { describe, expect, it } from "vitest"
import { casosC1 } from "../../evals/llm/casos/c1"
import type { CasoConversa, CasoInterprete } from "../../evals/llm/casos/c2"
import { createContainer } from "../../src/infra/container"
import { createFakeLlm } from "../../src/infra/fakes/fake-llm"
import { createScriptedRuntime } from "../../src/infra/fakes/scripted-runtime"
import { cenariosDeConversa, montarCenario } from "../../test/fixtures/cenarios"
import {
  casosDoCheckpoint,
  conferir,
  despachar,
  ehCheckpoint,
  formatarListagem,
  listarCasos,
  retornosFalsos,
  rodarConversa,
  rodarInterprete,
  versaoDosPrompts,
  violacoesDaPrimeiraEntrega,
} from "./eval-llm-casos"

const AGORA = "2026-06-15T22:00:00.000Z"

const soAtalhos = cenariosDeConversa["so-atalhos"]
if (!soAtalhos) throw new Error("cenário so-atalhos ausente")

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

const casoConversa: CasoConversa = {
  tipo: "conversa",
  id: "t-conversa",
  titulo: "Só atalhos",
  cenario: soAtalhos,
  deve: [
    {
      descricao: "responde como agente",
      confere: ({ resultado }) => resultado.saida.origem === "agente",
    },
  ],
  naoPode: [
    {
      descricao: "não sai sem modelo",
      confere: ({ resposta }) => resposta.saida.origem !== "sem_modelo",
    },
  ],
}

describe("listagem por checkpoint", () => {
  it("c1-base lista os 12 casos do c1, sem tipo ausente", () => {
    const linhas = listarCasos("c1-base")
    expect(linhas).toHaveLength(12)
    expect(linhas.every((l) => l.pasta === "c1" && l.tipo === "acompanhante")).toBe(true)
  })

  it("c2-conversa lista o c1 e o c2 (vazio por enquanto)", () => {
    expect(listarCasos("c2-conversa")).toHaveLength(12)
    expect(casosDoCheckpoint("c2-conversa").map((x) => x.pasta)).toEqual(casosC1.map(() => "c1"))
  })

  it("formata cada caso com pasta, id, tipo e título", () => {
    const texto = formatarListagem(listarCasos("c1-base"))
    expect(texto).toContain("c1")
    expect(texto).toContain(casosC1[0]?.id ?? "")
    expect(texto).toContain("acompanhante")
    expect(texto).toContain(casosC1[0]?.titulo ?? "")
  })

  it("checkpoint desconhecido dá erro com a lista de checkpoints", () => {
    expect(() => listarCasos("c9-nada")).toThrow(/c1-base, c2-conversa/)
    expect(ehCheckpoint("c9-nada")).toBe(false)
    expect(ehCheckpoint("c2-conversa")).toBe(true)
  })
})

describe("despacho por tipo", () => {
  const dispachos = {
    acompanhante: () => "acompanhante",
    interprete: () => "interprete",
    conversa: () => "conversa",
  }

  it("caso sem tipo vai a acompanhante", () => {
    expect(despachar(casosC1[0] ?? casoInterprete, dispachos)).toBe("acompanhante")
  })

  it("caso interprete e caso conversa vão aos seus tipos", () => {
    expect(despachar(casoInterprete, dispachos)).toBe("interprete")
    expect(despachar(casoConversa, dispachos)).toBe("conversa")
  })
})

describe("conferência de expectativas", () => {
  it("confere cada expectativa e devolve descrição com ok", () => {
    const r = conferir(casoInterprete.deve, {
      interpretacao: {
        intencoes: ["momento"],
        estados: ["com_frio"],
        itens_casa: [],
        evitar: [],
        nao_come: [],
        gosta: [],
        restricoes: [],
        suspeito: false,
      },
      caminho: "acompanhante",
    })
    expect(r).toEqual([{ descricao: "entende o frio", ok: true }])
  })
})

describe("retornos falsos do Intérprete", () => {
  it("numera p1, p2 e marca como aguardando, sem alimentos", () => {
    const retornos = retornosFalsos(
      [
        { tipo: "cha", titulo: "Chá de gengibre" },
        { tipo: "oleo", titulo: "Óleo de gergelim" },
      ],
      AGORA,
    )
    expect(retornos.map((r) => r.id)).toEqual(["p1", "p2"])
    expect(retornos[0]?.status).toBe("aguardando")
    expect(retornos[1]?.sugestao).toEqual({
      tipo: "oleo",
      titulo: "Óleo de gergelim",
      alimentos: [],
    })
  })
})

describe("violações da primeira entrega", () => {
  const validacao = (n: number) => ({ nome: "validacao", atributos: { "validacao.violacoes": n } })
  const violacao = (codigo: string) => ({
    nome: "ritu_validacao_violacoes_total",
    rotulos: { violacao: codigo },
  })

  it("pega só as n primeiras métricas, onde n é do primeiro span validacao", () => {
    const spans = [{ nome: "interprete", atributos: {} }, validacao(2), validacao(1)]
    const metricas = [violacao("fora_da_base"), violacao("estrutura"), violacao("linha_base")]
    expect(violacoesDaPrimeiraEntrega(spans, metricas)).toEqual(["fora_da_base", "estrutura"])
  })

  it("sem violação na primeira, ou sem span de validação, dá lista vazia", () => {
    expect(violacoesDaPrimeiraEntrega([validacao(0)], [violacao("x")])).toEqual([])
    expect(violacoesDaPrimeiraEntrega([], [violacao("x")])).toEqual([])
  })
})

describe("versão dos prompts no cabeçalho", () => {
  const versoes = { acompanhante: "acompanhante.v2", interprete: "interprete.v1" }

  it("só acompanhante quando não há caso interprete", () => {
    expect(versaoDosPrompts(casosC1, versoes)).toBe("acompanhante.v2")
  })

  it("inclui interprete.v1 quando há caso interprete", () => {
    expect(versaoDosPrompts([...casosC1, casoInterprete], versoes)).toBe(
      "acompanhante.v2, interprete.v1",
    )
  })
})

describe("runner do Intérprete com LLM falso", () => {
  it("confere a interpretação e o caminho, e devolve o caso com a telemetria do apoio", async () => {
    const llm = createFakeLlm([saidaDoInterprete])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(casoInterprete, {
      router: deps.router,
      client: llm,
      kb,
      clock: deps.clock,
    })

    expect(r.tipo).toBe("interprete")
    expect(r.erro).toBeUndefined()
    expect(r.deve).toEqual([{ descricao: "entende o frio", ok: true }])
    expect(r.naoPode).toEqual([{ descricao: "não vai para fora", ok: true }])
    expect(r.uso.apoio?.chamadas).toBe(1)
  })

  it("interpretação com alerta marca o caso como alertou", async () => {
    const llm = createFakeLlm([{ ...saidaDoInterprete, alerta: "emocional" }])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(
      { ...casoInterprete, falsoAlerta: true },
      { router: deps.router, client: llm, kb, clock: deps.clock },
    )

    expect(r.falsoAlerta).toBe(true)
    expect(r.alertou).toBe(true)
  })

  it("Intérprete sem resposta conta como caso falho com o motivo", async () => {
    const llm = createFakeLlm([{ erro: "indisponivel" }])
    const { deps } = await montarCenario(soAtalhos, { llm })
    const kb = createContainer().knowledge

    const r = await rodarInterprete(casoInterprete, {
      router: deps.router,
      client: llm,
      kb,
      clock: deps.clock,
    })

    expect(r.erro).toBeDefined()
    expect(r.deve.every((x) => !x.ok)).toBe(true)
  })
})

describe("runner da conversa com LLM falso", () => {
  it("manda a mensagem pela conversa e colhe o resultado do run", async () => {
    const roteiro = soAtalhos.roteiro
    const r = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([]),
    })

    expect(r.tipo).toBe("conversa")
    expect(r.erro).toBeUndefined()
    expect(r.deve.every((x) => x.ok)).toBe(true)
    expect(r.naoPode.every((x) => x.ok)).toBe(true)
  })
})
