import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import {
  type Interpretacao,
  normalizarInterpretacao,
} from "@/core/agents/interpreter/interpretacao"
import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import type { Estado } from "@/core/knowledge/vocab"
import type { Retorno } from "@/core/outcomes/ports"
import { getContainer } from "@/infra/container"
import { cenariosDeConversa, montarCenario } from "../../../test/fixtures/cenarios"

const kb = getContainer().knowledge

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

function normalizar(
  parcial: Partial<SaidaDoInterprete>,
  atalhos: Estado[] = [],
  pendentes: Retorno[] = [],
): Interpretacao {
  return normalizarInterpretacao(saida(parcial), { atalhos, pendentes, kb })
}

describe("normalizarInterpretacao: ids que a base não tem", () => {
  it("item de casa com nome fora da base entra só com o nome, sem alimento_id", () => {
    const i = normalizar({ itens_casa: [{ nome: "pitaia", acao: "tem" }] })

    expect(i.itens_casa).toEqual([{ nome: "pitaia", acao: "tem" }])
    expect(i.itens_casa[0]).not.toHaveProperty("alimento_id")
  })

  it("incômodo com id fora da base é descartado", () => {
    const i = normalizar({ incomodo: { id: "nao-existe" } })

    expect(i.incomodo).toBeUndefined()
  })

  it("variante fora do incômodo some, e o incômodo fica", () => {
    const i = normalizar({ incomodo: { id: "dor-de-cabeca", variante: "inventada" } })

    expect(i.incomodo).toEqual({ id: "dor-de-cabeca" })
  })

  it("variante que existe no incômodo fica", () => {
    const i = normalizar({ incomodo: { id: "dor-de-cabeca", variante: "latejante" } })

    expect(i.incomodo).toEqual({ id: "dor-de-cabeca", variante: "latejante" })
  })

  it("estado fora do vocabulário é ignorado", () => {
    const i = normalizar({ estados: ["inventado", "pesada"] })

    expect(i.estados).toEqual(["pesada"])
  })

  it("restrição fora do vocabulário é ignorada", () => {
    const i = normalizar({ restricoes: ["vegetariana", "inventada"] })

    expect(i.restricoes).toEqual(["vegetariana"])
  })

  it("suspeito e alerta chegam ao resultado como vieram", () => {
    const i = normalizar({ suspeito: true, alerta: "fisico" })

    expect(i.suspeito).toBe(true)
    expect(i.alerta).toBe("fisico")
  })
})

describe("normalizarInterpretacao: itens repetidos", () => {
  it("a última ocorrência vence, na posição da primeira", () => {
    const i = normalizar({
      itens_casa: [
        { nome: "abóbora", acao: "tem" },
        { nome: "couve", acao: "tem" },
        { nome: "abóbora", acao: "acabou" },
      ],
    })

    expect(i.itens_casa.map((item) => [item.alimento_id, item.acao])).toEqual([
      ["abobora", "acabou"],
      ["couve", "tem"],
    ])
  })

  it("nome livre repetido com outra caixa conta uma vez só", () => {
    const i = normalizar({
      itens_casa: [
        { nome: "pitaia", acao: "tem" },
        { nome: "Pitaia", acao: "tem" },
      ],
    })

    expect(i.itens_casa).toHaveLength(1)
  })

  it("evitar repetido conta uma vez só", () => {
    const i = normalizar({ evitar_sempre: ["camarão", "camarão"] })

    expect(i.evitar).toHaveLength(1)
  })
})

describe("normalizarInterpretacao: intenções incoerentes com os dados", () => {
  it("casa, retorno e evitar sem nada que as sustente saem; sobra vida", () => {
    const i = normalizar({ intencoes: ["casa", "evitar", "retorno"] })

    expect(i.intencoes).toEqual(["vida"])
  })

  it("casa com item fica; evitar sem item sai", () => {
    const i = normalizar({
      intencoes: ["casa", "evitar"],
      itens_casa: [{ nome: "abóbora", acao: "tem" }],
    })

    expect(i.intencoes).toEqual(["casa"])
  })

  it("item de casa sem intenção deduz casa", () => {
    const i = normalizar({ itens_casa: [{ nome: "abóbora", acao: "tem" }] })

    expect(i.intencoes).toEqual(["casa"])
  })

  it("estado sem intenção deduz momento", () => {
    const i = normalizar({ estados: ["pesada"] })

    expect(i.intencoes).toEqual(["momento"])
  })
})

describe("normalizarInterpretacao: lista vazia vira vida", () => {
  it("sem intenção e sem dados, o resultado é vida", () => {
    expect(normalizar({}).intencoes).toEqual(["vida"])
  })
})

describe("normalizarInterpretacao: atalhos e estados unidos sem repetir", () => {
  it("atalhos vêm primeiro, sem repetir os estados que já estavam", () => {
    const i = normalizar({ estados: ["agitada", "pesada", "inventado"] }, ["com_frio", "agitada"])

    expect(i.estados).toEqual(["com_frio", "agitada", "pesada"])
  })
})

describe("normalizarInterpretacao: gosta não passa por alimento evitado ou não comido", () => {
  it("gosta de alimento em evitar sempre sai", () => {
    const i = normalizar({ evitar_sempre: ["abóbora"], gosta: ["abóbora", "couve"] })

    expect(i.gosta.map((g) => g.alimento_id)).toEqual(["couve"])
  })

  it("gosta de alimento que a pessoa não come sai", () => {
    const i = normalizar({ nao_come: ["couve"], gosta: ["couve"] })

    expect(i.gosta).toEqual([])
  })
})

describe("normalizarInterpretacao: tetos de tamanho", () => {
  it("fato de rotina passa do teto e é cortado", () => {
    const i = normalizar({ fato_de_rotina: "a".repeat(300) })

    expect(i.fato_de_rotina).toHaveLength(config.conversa.maxFatoDeRotina)
  })

  it("itens de casa passam do teto e ficam no teto", () => {
    const itens = Array.from({ length: 12 }, (_, n) => ({
      nome: `item ${n}`,
      acao: "tem" as const,
    }))
    const i = normalizar({ itens_casa: itens })

    expect(i.itens_casa).toHaveLength(config.conversa.maxItensDeCasa)
  })

  it("nome livre passa do teto e é cortado", () => {
    const i = normalizar({ itens_casa: [{ nome: "x".repeat(60), acao: "tem" }] })

    expect(i.itens_casa[0]?.nome).toHaveLength(config.conversa.maxNomeLivre)
  })

  it("evitar passa do teto e fica no teto", () => {
    const textos = Array.from({ length: 8 }, (_, n) => `coisa ${n}`)
    const i = normalizar({ evitar_sempre: textos })

    expect(i.evitar).toHaveLength(config.conversa.maxEvitar)
  })
})

describe("normalizarInterpretacao: restrições sem repetir", () => {
  it("restrição repetida conta uma vez só", () => {
    const i = normalizar({ restricoes: ["vegana", "vegana"] })

    expect(i.restricoes).toEqual(["vegana"])
  })
})

describe("normalizarInterpretacao: retorno ligado pela posição pendente", () => {
  it("posição 1 liga ao retorno mais recente", async () => {
    const i = normalizar(
      { retorno: { resultado: "ajudou", pendente: 1 } },
      [],
      await pendentesDoCenario(),
    )

    expect(i.retorno?.titulo).toBe("Chá de gengibre com canela")
    expect(i.retorno?.retorno_id).toBeDefined()
  })

  it.each([0, 3, 1.5])("posição %s não liga a nenhum retorno", async (numero) => {
    const i = normalizar(
      { retorno: { resultado: "ajudou", pendente: numero } },
      [],
      await pendentesDoCenario(),
    )

    expect(i.retorno).toEqual({ resultado: "ajudou" })
  })
})

// Pendentes do cenário: o chá de hoje é o mais recente (posição 1); o arroz, de 2 dias, é a 2.
async function pendentesDoCenario() {
  const c = cenariosDeConversa["retorno-conversa"]
  if (!c) throw new Error("cenário ausente: retorno-conversa")
  const { contaId, deps } = await montarCenario(c)
  return deps.stores.outcomes.pendentes(contaId)
}

describe("normalizarInterpretacao, regra 3: nomes diferentes do mesmo alimento contam uma vez", () => {
  it("'abóbora' e 'Abobora' viram um item só, com o id da base", () => {
    const i = normalizar({
      itens_casa: [
        { nome: "abóbora", acao: "tem" },
        { nome: "Abobora", acao: "tem" },
      ],
    })

    expect(i.itens_casa).toHaveLength(1)
    expect(i.itens_casa[0]?.alimento_id).toBe("abobora")
  })
})

describe("normalizarInterpretacao, regra 4: não come", () => {
  it("nome da base recebe o id; nome fora da base fica sem id", () => {
    const i = normalizar({ nao_come: ["abóbora", "pitaia"] })

    expect(i.nao_come).toEqual([
      expect.objectContaining({ alimento_id: "abobora" }),
      { nome: "pitaia" },
    ])
  })

  it("repetido conta uma vez só, mesmo com outro nome do mesmo alimento", () => {
    const i = normalizar({ nao_come: ["abóbora", "Abobora", "abóbora"] })

    expect(i.nao_come).toHaveLength(1)
  })

  it("passa do teto maxEvitar e fica no teto", () => {
    const nomes = Array.from({ length: 8 }, (_, n) => `coisa ${n}`)
    const i = normalizar({ nao_come: nomes })

    expect(i.nao_come).toHaveLength(config.conversa.maxEvitar)
  })
})

describe("normalizarInterpretacao, regra 4a: gosta", () => {
  it("nome fora da base não fica", () => {
    expect(normalizar({ gosta: ["pitaia"] }).gosta).toEqual([])
  })

  it("repetido conta uma vez só", () => {
    const i = normalizar({ gosta: ["couve", "couve"] })

    expect(i.gosta).toHaveLength(1)
  })

  it("passa do teto maxEvitar e fica no teto", () => {
    const i = normalizar({
      gosta: ["abóbora", "couve", "arroz branco", "ghee", "gengibre", "canela", "cardamomo"],
    })

    expect(i.gosta).toHaveLength(config.conversa.maxEvitar)
  })

  it("sozinho não acrescenta intenção: sobra vida", () => {
    expect(normalizar({ gosta: ["couve"] }).intencoes).toEqual(["vida"])
  })
})

describe("normalizarInterpretacao, regra 7: intenções que os dados acrescentam", () => {
  it("incômodo válido acrescenta momento", () => {
    expect(normalizar({ incomodo: { id: "dor-de-cabeca" } }).intencoes).toEqual(["momento"])
  })

  it("retorno com pendente válido acrescenta retorno, mesmo sem intenção na saída", async () => {
    const i = normalizar(
      { retorno: { resultado: "ajudou", pendente: 1 } },
      [],
      await pendentesDoCenario(),
    )

    expect(i.intencoes).toEqual(["retorno"])
  })

  it.each([
    ["evitar_sempre", { evitar_sempre: ["camarão"] }],
    ["nao_come", { nao_come: ["couve"] }],
    ["restricoes", { restricoes: ["vegana"] }],
  ] as [string, Partial<SaidaDoInterprete>][])("item em %s acrescenta evitar", (_, parcial) => {
    expect(normalizar(parcial).intencoes).toEqual(["evitar"])
  })

  it("evitar pedida com dado fica na lista", () => {
    const i = normalizar({ intencoes: ["evitar"], evitar_sempre: ["camarão"] })

    expect(i.intencoes).toEqual(["evitar"])
  })
})
