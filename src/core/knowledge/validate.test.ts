import { describe, expect, it } from "vitest"
import { validarBase } from "./validate"
import { GUNAS } from "./vocab"

const refs = [{ ref: "fonte-a", campos: ["gunas"] }]
const fonte = { ref: "fonte-a", titulo: "Fonte A", autor: "Autora", aprovada: true }
const semCobertura = { cobertura: false }

function alimento(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "abobora",
    nome: "Abóbora",
    sinonimos: [],
    grupo: "legumes",
    durabilidade: "media",
    funcoes: ["legume"],
    rasa: ["doce"],
    virya: "quente",
    vipaka: "doce",
    gunas: ["pesado", "oleoso"],
    efeito: { vata: -1, pitta: -1, kapha: 1 },
    como_equilibrar: {},
    restricoes: [],
    grupos_evitar: [],
    marcas: [],
    fontes: refs,
    confianca: "alta",
    notas: "",
    ...sobrescrita,
  }
}

const gengibre = alimento({
  id: "gengibre",
  nome: "Gengibre",
  grupo: "especiarias",
  durabilidade: "longa",
  funcoes: ["tempero"],
  rasa: ["picante"],
  vipaka: "picante",
  gunas: ["quente", "leve"],
  efeito: { vata: -1, pitta: 1, kapha: -1 },
})

function dados(sobrescrita: Record<string, unknown> = {}) {
  return {
    alimentos: [alimento(), gengibre],
    preparos: [],
    praticas: [],
    combinacoes: [],
    doshas: [],
    estados: [],
    incomodos: [],
    quiz: [],
    gruposEvitar: [],
    vocabulario: GUNAS.map((guna) => ({ guna, nome: guna, verbo: null })),
    fontes: [fonte],
    ...sobrescrita,
  }
}

function preparo(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "sopa-de-legume",
    nome: "Sopa de legume",
    titulo: "Sopa de {legume}",
    vagas: [{ funcao: "legume", obrigatoria: true, maximo: 1 }],
    gunas_do_preparo: ["quente"],
    passos: "Cozinhe o {legume} em água.",
    momento: ["jantar"],
    contraindicacoes: [],
    fontes: refs,
    confianca: "media",
    ...sobrescrita,
  }
}

function pratica(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "cha-de-gengibre",
    tipo: "cha",
    nome: "Chá de gengibre",
    ingredientes: ["gengibre"],
    preparo: "Ferva o gengibre em água.",
    gunas: ["quente"],
    favorece_estados: ["com_frio"],
    efeito: { vata: -1, pitta: 1, kapha: -1 },
    momento: ["manha"],
    contraindicacoes: [],
    nunca_sugerir_se: [],
    aviso: "",
    fontes: refs,
    confianca: "media",
    ...sobrescrita,
  }
}

describe("validarBase · base válida", () => {
  it("não gera erros nem avisos para uma base mínima válida", () => {
    const resultado = validarBase(dados(), semCobertura)
    expect(resultado.erros).toEqual([])
    expect(resultado.avisos).toEqual([])
  })
})

describe("validarBase · schemas", () => {
  it("erro de schema vem com arquivo, id e campo", () => {
    const resultado = validarBase(
      dados({ alimentos: [alimento({ efeito: { vata: 3, pitta: 0, kapha: 0 } })] }),
      semCobertura,
    )
    expect(resultado.erros[0]?.startsWith("alimentos:abobora:efeito.vata ")).toBe(true)
  })

  it("lista todos os erros de uma vez", () => {
    const resultado = validarBase(
      dados({
        alimentos: [alimento({ efeito: { vata: 3, pitta: 0, kapha: 0 } }), gengibreComPar()],
      }),
      semCobertura,
    )
    expect(resultado.erros.some((e) => e.startsWith("alimentos:abobora:"))).toBe(true)
    expect(resultado.erros.some((e) => e.startsWith("alimentos:gengibre:"))).toBe(true)
  })

  it("recusa uma entrada que não é lista", () => {
    const resultado = validarBase(dados({ praticas: "nada" }), semCobertura)
    expect(resultado.erros).toContain("praticas precisa ser uma lista")
  })
})

function gengibreComPar() {
  return alimento({ id: "gengibre", gunas: ["quente", "frio"] })
}

describe("regra 1 · id repetido", () => {
  it("aponta o id repetido na mesma tabela", () => {
    const resultado = validarBase(dados({ alimentos: [alimento(), alimento()] }), semCobertura)
    expect(resultado.erros).toContain("alimentos:abobora:id repetido")
  })
})

describe("regra 2 · fonte inexistente", () => {
  it("aponta ref que não existe em fontes.yaml", () => {
    const resultado = validarBase(
      dados({ alimentos: [alimento({ fontes: [{ ref: "x", campos: ["nome"] }] })] }),
      semCobertura,
    )
    expect(resultado.erros).toContain('alimentos:abobora:fontes ref "x" não existe em fontes.yaml')
  })

  it("aceita a_confirmar sem exigir fontes.yaml", () => {
    const resultado = validarBase(
      dados({ alimentos: [alimento({ fontes: [{ ref: "a_confirmar", campos: ["gunas"] }] })] }),
      semCobertura,
    )
    expect(resultado.erros).toEqual([])
  })
})

describe("regra 3 · ingrediente e item de combinação", () => {
  it("aponta ingrediente de prática que não existe", () => {
    const resultado = validarBase(
      dados({ praticas: [pratica({ ingredientes: ["xyz"] })], estados: [] }),
      semCobertura,
    )
    expect(resultado.erros).toContain(
      'praticas:cha-de-gengibre:ingredientes "xyz" não existe em alimentos.yaml',
    )
  })

  it("aponta alimento inexistente e grupo fora do vocabulário em combinação", () => {
    const combinacao = {
      id: "par",
      itens: ["alimento:xyz", "grupo:nada"],
      motivo: "Combina.",
      fontes: refs,
      confianca: "media",
    }
    const resultado = validarBase(dados({ combinacoes: [combinacao] }), semCobertura)
    expect(resultado.erros).toContain(
      'combinacoes:par:itens "alimento:xyz" não existe em alimentos.yaml',
    )
    expect(resultado.erros).toContain('combinacoes:par:itens "grupo:nada" fora do vocabulário')
  })
})

describe("regras 4 e 5 · lacunas do preparo", () => {
  it("aponta placeholder de função sem vaga", () => {
    const resultado = validarBase(
      dados({ preparos: [preparo({ passos: "Cozinhe o {tempero}." })] }),
      semCobertura,
    )
    expect(resultado.erros).toContain(
      "preparos:sopa-de-legume:passos placeholder {tempero} sem vaga de tempero",
    )
  })

  it("exige lacuna de vaga obrigatória no título", () => {
    const resultado = validarBase(dados({ preparos: [preparo({ titulo: "Sopa" })] }), semCobertura)
    expect(resultado.erros).toContain(
      "preparos:sopa-de-legume:titulo sem lacuna de nenhuma vaga obrigatória",
    )
  })
})

describe("regra 6 · vaga com poucos alimentos possíveis", () => {
  it("aponta vaga com menos alimentos que o mínimo", () => {
    const resultado = validarBase(dados({ preparos: [preparo()] }), semCobertura)
    expect(resultado.erros).toContain(
      'preparos:sopa-de-legume:vagas vaga "legume" tem poucos alimentos possíveis (1, mínimo 3)',
    )
  })

  it("aceita a vaga com alimentos suficientes", () => {
    const alimentos = [
      alimento(),
      alimento({ id: "cenoura", nome: "Cenoura" }),
      alimento({ id: "beterraba", nome: "Beterraba" }),
      gengibre,
    ]
    const resultado = validarBase(dados({ alimentos, preparos: [preparo()] }), semCobertura)
    expect(resultado.erros).toEqual([])
  })

  describe("vaga listada em excecoesMinAlimentosPorVaga", () => {
    const leiteMorno = () =>
      preparo({
        id: "leite-morno-com-especiaria",
        titulo: "{liquido} morno com especiaria",
        vagas: [{ funcao: "liquido", obrigatoria: true, maximo: 1, grupos: ["laticinios"] }],
      })
    const leite = alimento({
      id: "leite",
      nome: "Leite",
      grupo: "laticinios",
      funcoes: ["liquido"],
      grupos_evitar: ["leite"],
    })

    it("aceita a vaga com 1 alimento possível", () => {
      const resultado = validarBase(
        dados({ alimentos: [leite, gengibre], preparos: [leiteMorno()] }),
        semCobertura,
      )
      expect(resultado.erros.some((e) => e.includes("poucos alimentos possíveis"))).toBe(false)
    })

    it("continua exigindo ao menos 1 alimento possível", () => {
      const resultado = validarBase(
        dados({ alimentos: [gengibre], preparos: [leiteMorno()] }),
        semCobertura,
      )
      expect(resultado.erros).toContain(
        'preparos:leite-morno-com-especiaria:vagas vaga "liquido" tem poucos alimentos possíveis (0, mínimo 1)',
      )
    })
  })
})

describe("regra 7 · prática de óleo sem óleo", () => {
  it("aponta prática do tipo oleo sem ingrediente do grupo oleos", () => {
    const resultado = validarBase(
      dados({ praticas: [pratica({ id: "oleo-x", tipo: "oleo" })] }),
      semCobertura,
    )
    expect(resultado.erros).toContain(
      "praticas:oleo-x:ingredientes prática de óleo sem ingrediente do grupo oleos",
    )
  })
})

describe("regra 8 · grupos_evitar obrigatório", () => {
  it("exige leite para ghee e soja para tofu, quando o id existe", () => {
    const alimentos = [
      alimento({ id: "ghee", nome: "Ghee", grupo: "laticinios", funcoes: ["gordura"] }),
      alimento({ id: "tofu", nome: "Tofu", grupo: "leguminosas", grupos_evitar: ["soja"] }),
    ]
    const resultado = validarBase(dados({ alimentos }), semCobertura)
    expect(resultado.erros).toContain('alimentos:ghee:grupos_evitar falta "leite"')
    expect(resultado.erros.some((e) => e.startsWith("alimentos:tofu:grupos_evitar"))).toBe(false)
  })
})

describe("regra 9 · óleo prensado a frio", () => {
  it("exige a observação de prensado a frio em óleo que não é ghee", () => {
    const azeite = alimento({
      id: "azeite",
      nome: "Azeite",
      grupo: "oleos",
      funcoes: ["gordura"],
      observacao: "Azeite extravirgem.",
    })
    const resultado = validarBase(dados({ alimentos: [azeite] }), semCobertura)
    expect(resultado.erros).toContain('alimentos:azeite:observacao óleo sem "prensado a frio"')
  })

  it("dispensa o ghee", () => {
    const ghee = alimento({
      id: "ghee",
      nome: "Ghee",
      grupo: "oleos",
      funcoes: ["gordura"],
      grupos_evitar: ["leite"],
    })
    const resultado = validarBase(dados({ alimentos: [ghee] }), semCobertura)
    expect(resultado.erros.some((e) => e.includes("prensado a frio"))).toBe(false)
  })
})

describe("regra 10 · quiz com uma opção por dosha", () => {
  it("recusa duas opções da mesma dosha", () => {
    const pergunta = {
      id: "sono-1",
      tema: "sono",
      texto: "Como você dorme?",
      opcoes: [
        { dosha: "vata", texto: "a" },
        { dosha: "vata", texto: "b" },
        { dosha: "kapha", texto: "c" },
      ],
      fontes: refs,
    }
    const resultado = validarBase(dados({ quiz: [pergunta] }), semCobertura)
    expect(
      resultado.erros.some(
        (e) =>
          e.startsWith("quiz:sono-1:opcoes") &&
          e.includes("cada dosha precisa aparecer em exatamente uma opção"),
      ),
    ).toBe(true)
  })
})

describe("regra 11 · estado e qualidade sem linha na base", () => {
  it("aponta estado sem linha em estados.yaml", () => {
    const resultado = validarBase(dados({ praticas: [pratica()], estados: [] }), semCobertura)
    expect(resultado.erros).toContain(
      'praticas:cha-de-gengibre:favorece_estados estado "com_frio" sem linha em estados.yaml',
    )
  })

  it("aponta guna sem linha em vocabulario.yaml", () => {
    const resultado = validarBase(dados({ vocabulario: [] }), semCobertura)
    expect(resultado.erros).toContain(
      'alimentos:abobora:gunas guna "pesado" sem linha em vocabulario.yaml',
    )
  })
})

describe("regra 12 · fonte com url sem data de acesso", () => {
  it("aponta fonte com url e sem acessado_em", () => {
    const comUrl = {
      ref: "banyan",
      titulo: "Banyan",
      autor: "Banyan Botanicals",
      aprovada: true,
      url: "https://banyanbotanicals.com/x",
    }
    const resultado = validarBase(dados({ fontes: [comUrl] }), semCobertura)
    expect(resultado.erros).toContain("fontes:banyan:acessado_em ausente com url")
  })
})

describe("regra 13 · cobertura", () => {
  it("gera erros cobertura: quando a base está abaixo do mínimo", () => {
    const resultado = validarBase(dados())
    expect(resultado.erros).toContain("cobertura: alimentos tem 2, mínimo 130")
    expect(resultado.erros.every((e) => e.startsWith("cobertura:"))).toBe(true)
  })

  it("não gera erros de cobertura com cobertura: false", () => {
    expect(validarBase(dados(), semCobertura).erros).toEqual([])
  })
})

describe("avisos e contagens", () => {
  it("avisa linha com a_confirmar e fonte não aprovada", () => {
    const naoAprovada = { ref: "outra", titulo: "Outra", autor: "Autor", aprovada: false }
    const resultado = validarBase(
      dados({
        alimentos: [alimento({ fontes: [{ ref: "a_confirmar", campos: ["gunas"] }] }), gengibre],
        fontes: [fonte, naoAprovada],
      }),
      semCobertura,
    )
    expect(resultado.avisos).toContain("alimentos:abobora: linha com fonte a_confirmar")
    expect(resultado.avisos).toContain("fontes:outra: fonte não aprovada")
  })

  it("conta por arquivo, grupo, tipo de prática e a_confirmar", () => {
    const resultado = validarBase(
      dados({
        alimentos: [alimento({ fontes: [{ ref: "a_confirmar", campos: ["gunas"] }] }), gengibre],
      }),
      semCobertura,
    )
    expect(resultado.contagens.porArquivo.alimentos).toBe(2)
    expect(resultado.contagens.alimentosPorGrupo.legumes).toBe(1)
    expect(resultado.contagens.praticasPorTipo.cha).toBe(0)
    expect(resultado.contagens.aConfirmar).toBe(1)
  })
})
