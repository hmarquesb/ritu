import { describe, expect, it } from "vitest"
import type { Estado } from "@/core/knowledge/vocab"
import type { Retorno } from "@/core/outcomes/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { interpretacaoDosAtalhos, normalizarInterpretacao } from "./interpretacao"
import type { SaidaDoInterprete } from "./saida"

const kb = createMiniKnowledge()

function saida(parcial: Partial<SaidaDoInterprete> = {}): SaidaDoInterprete {
  return {
    intencoes: [],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
    ...parcial,
  }
}

function retornoPendente(id: string, titulo: string): Retorno {
  return {
    id,
    conta_id: "conta-1",
    run_id: "run-1",
    sugestao: { tipo: "cha", alimentos: [], titulo },
    status: "aguardando",
    resultado: null,
    origem: null,
    criado_em: "2026-11-14T10:00:00.000Z",
    respondido_em: null,
  }
}

function interpretar(
  parcial: Partial<SaidaDoInterprete>,
  opcoes: { atalhos?: Estado[]; pendentes?: Retorno[] } = {},
) {
  return normalizarInterpretacao(saida(parcial), {
    atalhos: opcoes.atalhos ?? [],
    pendentes: opcoes.pendentes ?? [],
    kb,
  })
}

describe("normalizarInterpretacao: estados", () => {
  it("descarta o estado que não existe em ESTADOS", () => {
    const r = interpretar({ intencoes: ["momento"], estados: ["estado-inventado", "seca"] })
    expect(r.estados).toEqual(["seca"])
  })

  it("une os estados com os atalhos, sem repetir, com os atalhos primeiro", () => {
    const r = interpretar(
      { intencoes: ["momento"], estados: ["seca", "pesada"] },
      { atalhos: ["pesada"] },
    )
    expect(r.estados).toEqual(["pesada", "seca"])
  })
})

describe("normalizarInterpretacao: incômodo", () => {
  it("tira o incômodo cujo id não existe na base", () => {
    const r = interpretar({ intencoes: ["momento"], incomodo: { id: "nao-existe" } })
    expect(r.incomodo).toBeUndefined()
  })

  it("mantém o incômodo e tira a variante que não existe nele", () => {
    const r = interpretar({
      intencoes: ["momento"],
      incomodo: { id: "dor-de-cabeca", variante: "inventada" },
    })
    expect(r.incomodo).toEqual({ id: "dor-de-cabeca" })
    expect(r.incomodo?.variante).toBeUndefined()
  })

  it("mantém a variante que existe no incômodo", () => {
    const r = interpretar({
      intencoes: ["momento"],
      incomodo: { id: "dor-de-cabeca", variante: "latejante" },
    })
    expect(r.incomodo).toEqual({ id: "dor-de-cabeca", variante: "latejante" })
  })
})

describe("normalizarInterpretacao: itens de casa", () => {
  it("corta o nome livre desconhecido em 40 caracteres", () => {
    const r = interpretar({
      intencoes: ["casa"],
      itens_casa: [{ nome: "a".repeat(50), acao: "tem" }],
    })
    expect(r.itens_casa).toHaveLength(1)
    expect(r.itens_casa[0]?.nome).toHaveLength(40)
    expect(r.itens_casa[0]?.alimento_id).toBeUndefined()
  })

  it("liga o nome que é da base ao id e usa o nome da base", () => {
    const r = interpretar({ intencoes: ["casa"], itens_casa: [{ nome: "banana", acao: "tem" }] })
    expect(r.itens_casa).toEqual([{ alimento_id: "banana", nome: "Banana", acao: "tem" }])
  })

  it("repete pelo nome normalizado e vale a última ocorrência", () => {
    const r = interpretar({
      intencoes: ["casa"],
      itens_casa: [
        { nome: "Pão de queijo", acao: "tem" },
        { nome: "pao de queijo!", acao: "acabou" },
      ],
    })
    expect(r.itens_casa).toHaveLength(1)
    expect(r.itens_casa[0]?.acao).toBe("acabou")
  })

  it("tem e depois acabou do mesmo alimento da base fica acabou", () => {
    const r = interpretar({
      intencoes: ["casa"],
      itens_casa: [
        { nome: "Banana", acao: "tem" },
        { nome: "banana", acao: "acabou" },
      ],
    })
    expect(r.itens_casa).toEqual([{ alimento_id: "banana", nome: "Banana", acao: "acabou" }])
  })

  it("tira nome vazio e corta a lista em 10 itens", () => {
    const itens = Array.from({ length: 12 }, (_, i) => ({
      nome: `item ${i + 1}`,
      acao: "tem" as const,
    }))
    const r = interpretar({
      intencoes: ["casa"],
      itens_casa: [{ nome: "   ", acao: "tem" }, ...itens],
    })
    expect(r.itens_casa).toHaveLength(10)
    expect(r.itens_casa.every((item) => item.nome !== "")).toBe(true)
  })
})

describe("normalizarInterpretacao: evitar, não come e gosta", () => {
  it("não repete o que está em evitar_sempre", () => {
    const r = interpretar({ intencoes: ["evitar"], evitar_sempre: ["Leite", "leite"] })
    expect(r.evitar).toEqual([{ tipo: "alimento", valor: "leite" }])
  })

  it("corta evitar em 5 itens", () => {
    const textos = Array.from({ length: 7 }, (_, i) => `texto ${i + 1}`)
    const r = interpretar({ intencoes: ["evitar"], evitar_sempre: textos })
    expect(r.evitar).toHaveLength(5)
  })

  it("resolve um texto que é grupo de evitar", () => {
    const r = interpretar({ intencoes: ["evitar"], evitar_sempre: ["laticínio"] })
    expect(r.evitar).toEqual([{ tipo: "grupo", valor: "leite" }])
  })

  it("liga o não come da base ao id e deixa o livre só com o nome", () => {
    const r = interpretar({ intencoes: ["evitar"], nao_come: ["Mel", "Sopa rara"] })
    expect(r.nao_come).toEqual([{ alimento_id: "mel", nome: "Mel" }, { nome: "Sopa rara" }])
  })

  it("tira do gosta o que não é da base", () => {
    const r = interpretar({ intencoes: ["vida"], gosta: ["Banana", "Jaca rara"] })
    expect(r.gosta).toEqual([{ alimento_id: "banana", nome: "Banana" }])
  })

  it("tira do gosta o que está em nao_come", () => {
    const r = interpretar({ intencoes: ["vida"], nao_come: ["Mel"], gosta: ["Mel", "Banana"] })
    expect(r.gosta).toEqual([{ alimento_id: "banana", nome: "Banana" }])
  })

  it("tira do gosta o alimento que está em evitar", () => {
    const r = interpretar({
      intencoes: ["vida"],
      evitar_sempre: ["Leite"],
      gosta: ["Leite", "Banana"],
    })
    expect(r.gosta).toEqual([{ alimento_id: "banana", nome: "Banana" }])
  })

  it("não acrescenta intenção quando só há gosto", () => {
    const r = interpretar({ intencoes: [], gosta: ["Banana"] })
    expect(r.intencoes).toEqual(["vida"])
  })
})

describe("normalizarInterpretacao: restrições", () => {
  it("fica só com os ids de RESTRICOES, sem repetir", () => {
    const r = interpretar({
      intencoes: ["evitar"],
      restricoes: ["vegana", "inventada", "vegana"],
    })
    expect(r.restricoes).toEqual(["vegana"])
  })
})

describe("normalizarInterpretacao: retorno", () => {
  const pendentes = [
    retornoPendente("ret-2", "Chá de gengibre"),
    retornoPendente("ret-1", "Mingau"),
  ]

  it("liga o retorno ao pendente de número 1, o mais recente", () => {
    const r = interpretar(
      { intencoes: ["retorno"], retorno: { resultado: "ajudou", pendente: 1 } },
      { pendentes },
    )
    expect(r.retorno).toEqual({
      resultado: "ajudou",
      retorno_id: "ret-2",
      titulo: "Chá de gengibre",
    })
  })

  it("liga o retorno ao último pendente quando o número é igual ao tamanho", () => {
    const r = interpretar(
      { intencoes: ["retorno"], retorno: { resultado: "nao_ajudou", pendente: 2 } },
      { pendentes },
    )
    expect(r.retorno).toEqual({ resultado: "nao_ajudou", retorno_id: "ret-1", titulo: "Mingau" })
  })

  it("fica só com o resultado quando o pendente é 0", () => {
    const r = interpretar(
      { intencoes: ["retorno"], retorno: { resultado: "nao_fez", pendente: 0 } },
      { pendentes },
    )
    expect(r.retorno).toEqual({ resultado: "nao_fez" })
  })

  it("fica só com o resultado quando o pendente é maior que o tamanho", () => {
    const r = interpretar(
      { intencoes: ["retorno"], retorno: { resultado: "ajudou", pendente: 3 } },
      { pendentes },
    )
    expect(r.retorno).toEqual({ resultado: "ajudou" })
  })

  it("fica só com o resultado quando o pendente está ausente", () => {
    const r = interpretar(
      { intencoes: ["retorno"], retorno: { resultado: "ajudou" } },
      { pendentes },
    )
    expect(r.retorno).toEqual({ resultado: "ajudou" })
  })
})

describe("normalizarInterpretacao: fato de rotina", () => {
  it("corta o fato em 200 caracteres", () => {
    const r = interpretar({ intencoes: ["vida"], fato_de_rotina: "x".repeat(300) })
    expect(r.fato_de_rotina).toHaveLength(200)
  })

  it("tira o fato vazio", () => {
    const r = interpretar({ intencoes: ["vida"], fato_de_rotina: "   " })
    expect(r.fato_de_rotina).toBeUndefined()
  })
})

describe("normalizarInterpretacao: coerência das intenções", () => {
  it("tira casa quando não há item de casa", () => {
    const r = interpretar({ intencoes: ["casa", "momento"], estados: ["seca"] })
    expect(r.intencoes).not.toContain("casa")
  })

  it("acrescenta casa quando há item e a intenção não veio", () => {
    const r = interpretar({
      intencoes: ["vida"],
      itens_casa: [{ nome: "Banana", acao: "tem" }],
    })
    expect(r.intencoes).toEqual(["vida", "casa"])
  })

  it("tira retorno quando não há o campo retorno", () => {
    const r = interpretar({ intencoes: ["retorno", "vida"] })
    expect(r.intencoes).not.toContain("retorno")
  })

  it("acrescenta retorno quando há o campo retorno", () => {
    const r = interpretar({ intencoes: ["vida"], retorno: { resultado: "ajudou" } })
    expect(r.intencoes).toContain("retorno")
  })

  it("acrescenta evitar quando só há restrição", () => {
    const r = interpretar({ intencoes: ["vida"], restricoes: ["vegana"] })
    expect(r.intencoes).toContain("evitar")
  })

  it("tira evitar quando não há nada em evitar, não come nem restrição", () => {
    const r = interpretar({ intencoes: ["evitar", "momento"], estados: ["seca"] })
    expect(r.intencoes).not.toContain("evitar")
  })

  it("acrescenta momento quando há estado", () => {
    const r = interpretar({ intencoes: ["vida"], estados: ["seca"] })
    expect(r.intencoes).toContain("momento")
  })

  it("acrescenta momento quando há incômodo", () => {
    const r = interpretar({ intencoes: ["vida"], incomodo: { id: "dor-de-cabeca" } })
    expect(r.intencoes).toContain("momento")
  })

  it("não repete intenção", () => {
    const r = interpretar({
      intencoes: ["casa", "casa"],
      itens_casa: [{ nome: "Banana", acao: "tem" }],
    })
    expect(r.intencoes.filter((i) => i === "casa")).toHaveLength(1)
  })

  it("vira vida quando a lista de intenções fica vazia", () => {
    const r = interpretar({})
    expect(r.intencoes).toEqual(["vida"])
  })

  it("passa alerta e suspeito como vieram", () => {
    const r = interpretar({ intencoes: ["vida"], alerta: "fisico", suspeito: true })
    expect(r.alerta).toBe("fisico")
    expect(r.suspeito).toBe(true)
  })
})

describe("interpretacaoDosAtalhos", () => {
  it("devolve momento, os atalhos sem repetir e as listas vazias", () => {
    const r = interpretacaoDosAtalhos(["pesada", "pesada", "seca"])
    expect(r).toEqual({
      intencoes: ["momento"],
      estados: ["pesada", "seca"],
      itens_casa: [],
      evitar: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    })
  })
})
