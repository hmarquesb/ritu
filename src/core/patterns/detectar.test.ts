import { describe, expect, it } from "vitest"
import {
  detectarAjudaEmEstado,
  detectarEstadosJuntos,
  type MomentoRegistrado,
  type RetornoRegistrado,
} from "./detectar"
import type { ItemDoPadrao } from "./textos"

const CHA: ItemDoPadrao = { tipo: "pratica", id: "cha-gengibre-canela" }
const OLEO: ItemDoPadrao = { tipo: "preparo", id: "oleo-gergelim-morno" }
const FRIO_AGITADA = ["com_frio", "agitada"] as const

let sequencia = 0
function retorno(
  dia: string,
  estados: RetornoRegistrado["estados"],
  resultado: "ajudou" | "nao_ajudou",
  extra: Partial<Pick<RetornoRegistrado, "item" | "titulo" | "respondido_em">> = {},
): RetornoRegistrado {
  sequencia += 1
  return {
    dia,
    estados,
    item: extra.item ?? CHA,
    titulo: extra.titulo ?? "Chá de gengibre com canela",
    resultado,
    respondido_em: extra.respondido_em ?? `${dia}T10:${String(sequencia).padStart(2, "0")}:00Z`,
  }
}

function momento(dia: string, estados: MomentoRegistrado["estados"]): MomentoRegistrado {
  return { dia, estados }
}

describe("detectarAjudaEmEstado", () => {
  it("vale com 3 'ajudou' e 1 'não ajudou' (75%) nos runs com o par: um candidato com a chave do par", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-03", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-04", [...FRIO_AGITADA], "nao_ajudou"),
    ]
    expect(detectarAjudaEmEstado(retornos)).toEqual([
      {
        tipo: "ajuda_em_estado",
        chave: "com_frio+agitada|pratica:cha-gengibre-canela",
        frase: "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar.",
        ocorrencias: 3,
      },
    ])
  })

  it("não vale com 2 'ajudou' e 1 'não ajudou' (abaixo do mínimo de 3)", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-03", [...FRIO_AGITADA], "nao_ajudou"),
    ]
    expect(detectarAjudaEmEstado(retornos)).toEqual([])
  })

  it("não vale com 3 'ajudou' e 2 'não ajudou' (60%, abaixo de 75%)", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-03", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-04", [...FRIO_AGITADA], "nao_ajudou"),
      retorno("2026-10-05", [...FRIO_AGITADA], "nao_ajudou"),
    ]
    expect(detectarAjudaEmEstado(retornos)).toEqual([])
  })

  it("vale com 3 'ajudou' e nenhum 'não ajudou' (100%)", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-03", [...FRIO_AGITADA], "ajudou"),
    ]
    const [achado] = detectarAjudaEmEstado(retornos)
    expect(achado?.ocorrencias).toBe(3)
    expect(achado?.chave).toBe("com_frio+agitada|pratica:cha-gengibre-canela")
  })

  it("o grupo de um estado ganha quando o par fica abaixo do mínimo e tem mais 'ajudou'", () => {
    const retornos = [
      retorno("2026-10-01", ["com_frio"], "ajudou"),
      retorno("2026-10-02", ["com_frio"], "ajudou"),
      retorno("2026-10-03", ["com_frio", "agitada"], "ajudou"),
    ]
    expect(detectarAjudaEmEstado(retornos)).toEqual([
      {
        tipo: "ajuda_em_estado",
        chave: "com_frio|pratica:cha-gengibre-canela",
        frase: "Quando você está com frio, chá de gengibre com canela costuma te ajudar.",
        ocorrencias: 3,
      },
    ])
  })

  it("no empate de 'ajudou' entre um estado e o par, fica o de mais estados", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou"),
      retorno("2026-10-03", [...FRIO_AGITADA], "ajudou"),
    ]
    const saida = detectarAjudaEmEstado(retornos)
    expect(saida).toHaveLength(1)
    expect(saida[0]?.chave).toBe("com_frio+agitada|pratica:cha-gengibre-canela")
  })

  it("dá uma chave por sugestão (por item), em ordem de chave", () => {
    const retornos = [
      retorno("2026-10-01", ["com_frio"], "ajudou", { item: CHA }),
      retorno("2026-10-02", ["com_frio"], "ajudou", { item: CHA }),
      retorno("2026-10-03", ["com_frio"], "ajudou", { item: CHA }),
      retorno("2026-10-01", ["com_frio"], "ajudou", {
        item: OLEO,
        titulo: "Óleo de gergelim morno",
      }),
      retorno("2026-10-02", ["com_frio"], "ajudou", {
        item: OLEO,
        titulo: "Óleo de gergelim morno",
      }),
      retorno("2026-10-03", ["com_frio"], "ajudou", {
        item: OLEO,
        titulo: "Óleo de gergelim morno",
      }),
    ]
    expect(detectarAjudaEmEstado(retornos).map((p) => p.chave)).toEqual([
      "com_frio|pratica:cha-gengibre-canela",
      "com_frio|preparo:oleo-gergelim-morno",
    ])
  })

  it("o título é o do retorno respondido mais recente do grupo", () => {
    const retornos = [
      retorno("2026-10-01", [...FRIO_AGITADA], "ajudou", {
        titulo: "Chá de gengibre com canela",
        respondido_em: "2026-10-01T10:00:00Z",
      }),
      retorno("2026-10-02", [...FRIO_AGITADA], "ajudou", {
        titulo: "Chá de canela",
        respondido_em: "2026-10-09T10:00:00Z",
      }),
      retorno("2026-10-03", [...FRIO_AGITADA], "ajudou", {
        titulo: "Chá de gengibre",
        respondido_em: "2026-10-05T10:00:00Z",
      }),
    ]
    expect(detectarAjudaEmEstado(retornos)[0]?.frase).toBe(
      "Quando você está com frio e agitada, chá de canela costuma te ajudar.",
    )
  })

  it("sem retornos, não há candidato", () => {
    expect(detectarAjudaEmEstado([])).toEqual([])
  })
})

describe("detectarEstadosJuntos", () => {
  it("pesada em 4 dias, 3 com sem_energia no mesmo run e 1 dia só com sem_energia: pesada > sem energia (empate, fica o 'a' antes em ESTADOS)", () => {
    const momentos = [
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
      momento("2026-10-04", ["pesada"]),
      momento("2026-10-05", ["sem_energia"]),
    ]
    expect(detectarEstadosJuntos(momentos)).toEqual([
      {
        tipo: "estados_juntos",
        chave: "pesada>sem_energia",
        frase: "Quando você está pesada, costuma estar também sem energia.",
        ocorrencias: 3,
      },
    ])
  })

  it("pesada em 5 dias, 3 com sem_energia e 2 dias só com sem_energia: nada (60% nos dois sentidos)", () => {
    const momentos = [
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
      momento("2026-10-04", ["pesada"]),
      momento("2026-10-05", ["pesada"]),
      momento("2026-10-06", ["sem_energia"]),
      momento("2026-10-07", ["sem_energia"]),
    ]
    expect(detectarEstadosJuntos(momentos)).toEqual([])
  })

  it("dois runs do mesmo dia com o par juntos contam o dia uma vez (ocorrencias 3, não 4)", () => {
    const momentos = [
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
      momento("2026-10-04", ["pesada"]),
      momento("2026-10-05", ["sem_energia"]),
    ]
    const [achado] = detectarEstadosJuntos(momentos)
    expect(achado?.chave).toBe("pesada>sem_energia")
    expect(achado?.ocorrencias).toBe(3)
  })

  it("pesada e sem_energia em runs diferentes do mesmo dia não contam como juntos", () => {
    const momentos = [
      momento("2026-10-01", ["pesada"]),
      momento("2026-10-01", ["sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
      momento("2026-10-04", ["pesada", "sem_energia"]),
    ]
    const saida = detectarEstadosJuntos(momentos)
    expect(saida.map((p) => p.chave)).toEqual(["pesada>sem_energia"])
    expect(saida[0]?.ocorrencias).toBe(3)
  })

  it("os dois sentidos valendo ficam com um: o de maior proporção", () => {
    const momentos = [
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
      momento("2026-10-04", ["pesada"]),
    ]
    expect(detectarEstadosJuntos(momentos)).toEqual([
      {
        tipo: "estados_juntos",
        chave: "sem_energia>pesada",
        frase: "Quando você está sem energia, costuma estar também pesada.",
        ocorrencias: 3,
      },
    ])
  })

  it("no empate total, fica o de 'a' antes em ESTADOS", () => {
    const momentos = [
      momento("2026-10-01", ["pesada", "sem_energia"]),
      momento("2026-10-02", ["pesada", "sem_energia"]),
      momento("2026-10-03", ["pesada", "sem_energia"]),
    ]
    expect(detectarEstadosJuntos(momentos).map((p) => p.chave)).toEqual(["pesada>sem_energia"])
  })

  it("sem momentos, não há candidato", () => {
    expect(detectarEstadosJuntos([])).toEqual([])
  })
})
