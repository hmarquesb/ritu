import { describe, expect, it } from "vitest"
import {
  alimentoSchema,
  combinacaoSchema,
  dadosDaBaseSchema,
  doshaInfoSchema,
  estadoInfoSchema,
  fonteRefSchema,
  fonteSchema,
  grupoEvitarInfoSchema,
  incomodoSchema,
  perguntaQuizSchema,
  praticaSchema,
  preparoSchema,
  vagaSchema,
  vocabuloGunaSchema,
} from "./schemas"

const fontes = [{ ref: "a_confirmar", campos: ["gunas"] }]

function alimentoValido(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "abobora",
    nome: "Abóbora",
    sinonimos: ["moranga"],
    grupo: "legumes",
    durabilidade: "media",
    funcoes: ["legume"],
    rasa: ["doce"],
    virya: "quente",
    vipaka: "doce",
    gunas: ["pesado", "oleoso"],
    efeito: { vata: -1, pitta: -1, kapha: 1 },
    como_equilibrar: { vata: "Pode ajudar a aliviar a sensação de secura." },
    restricoes: [],
    grupos_evitar: [],
    marcas: [],
    fontes,
    confianca: "baixa",
    notas: "",
    ...sobrescrita,
  }
}

function preparoValido(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "kitchari-simples",
    nome: "Kitchari simples",
    titulo: "Kitchari leve para o almoço",
    vagas: [
      { funcao: "base", obrigatoria: true },
      { funcao: "legume", obrigatoria: false },
    ],
    gunas_do_preparo: ["pesado", "oleoso"],
    passos: "Cozinhe {funcao} com água até ficar macio.",
    momento: ["almoco"],
    contraindicacoes: [],
    fontes,
    confianca: "media",
    ...sobrescrita,
  }
}

function praticaValida(sobrescrita: Record<string, unknown> = {}) {
  return {
    id: "cha-de-gengibre",
    tipo: "cha",
    nome: "Chá de gengibre",
    ingredientes: ["gengibre"],
    preparo: "Ferva a água e deixa o gengibre em infusão por alguns minutos.",
    gunas: ["quente", "leve"],
    favorece_estados: ["com_frio"],
    efeito: { vata: -1, pitta: 1, kapha: -1 },
    momento: ["manha"],
    contraindicacoes: [],
    nunca_sugerir_se: [],
    aviso: "",
    fontes,
    confianca: "alta",
    ...sobrescrita,
  }
}

function varianteValida(id: string) {
  return {
    id,
    opcao: `Opção ${id}`,
    presentes: [],
    favorecer: ["quente"],
    evitar_gunas: [],
    evitar_marcas: [],
    evitar_texto: "",
  }
}

function incomodoComVariantes(quantidade: number, sobrescrita: Record<string, unknown> = {}) {
  const variantes = ["a", "b", "c"].slice(0, quantidade).map(varianteValida)
  return {
    id: "gases",
    nome: "Gases",
    palavras: ["gases", "estufado"],
    variantes,
    fontes,
    confianca: "baixa",
    ...sobrescrita,
  }
}

describe("alimentoSchema", () => {
  it("aceita um alimento válido completo", () => {
    expect(alimentoSchema.safeParse(alimentoValido()).success).toBe(true)
  })

  it.each(["umido", "estimulante", "nutritivo"])("recusa a guna fora do vocabulário: %s", (g) => {
    expect(alimentoSchema.safeParse(alimentoValido({ gunas: [g] })).success).toBe(false)
  })

  it("recusa dois gunas de um mesmo par", () => {
    expect(alimentoSchema.safeParse(alimentoValido({ gunas: ["quente", "frio"] })).success).toBe(
      false,
    )
  })

  it("recusa mais de 4 gunas e lista vazia", () => {
    const cinco = ["pesado", "oleoso", "estavel", "suave", "intenso"]
    expect(alimentoSchema.safeParse(alimentoValido({ gunas: cinco })).success).toBe(false)
    expect(alimentoSchema.safeParse(alimentoValido({ gunas: [] })).success).toBe(false)
  })

  it.each([3, -3, 1.5])("recusa efeito.vata = %s", (valor) => {
    const efeito = { vata: valor, pitta: 0, kapha: 0 }
    expect(alimentoSchema.safeParse(alimentoValido({ efeito })).success).toBe(false)
  })

  it("aceita efeito nos limites -2 e +2", () => {
    const efeito = { vata: -2, pitta: 2, kapha: 0 }
    expect(alimentoSchema.safeParse(alimentoValido({ efeito })).success).toBe(true)
  })

  it("recusa alimento sem fontes", () => {
    expect(alimentoSchema.safeParse(alimentoValido({ fontes: [] })).success).toBe(false)
  })

  it("recusa como_equilibrar com mais de 120 caracteres", () => {
    const como_equilibrar = { vata: "a".repeat(121) }
    expect(alimentoSchema.safeParse(alimentoValido({ como_equilibrar })).success).toBe(false)
  })

  it("recusa campo desconhecido (objeto estrito)", () => {
    expect(alimentoSchema.safeParse(alimentoValido({ campo_extra: 1 })).success).toBe(false)
  })

  it("recusa id que não é kebab-case", () => {
    expect(alimentoSchema.safeParse(alimentoValido({ id: "Abobora Doce" })).success).toBe(false)
  })
})

describe("fonteRefSchema e fonteSchema", () => {
  it("aceita ref a_confirmar e ref registrada", () => {
    expect(fonteRefSchema.safeParse({ ref: "a_confirmar", campos: ["gunas"] }).success).toBe(true)
    expect(
      fonteRefSchema.safeParse({ ref: "ayurveda-com-doshas", campos: ["efeito"] }).success,
    ).toBe(true)
  })

  it("aceita uma fonte com os campos opcionais ausentes", () => {
    const fonte = {
      ref: "ayurveda-com-doshas",
      titulo: "Doshas",
      autor: "Ayurvedic Institute",
      aprovada: true,
    }
    expect(fonteSchema.safeParse(fonte).success).toBe(true)
  })
})

describe("vagaSchema", () => {
  it("aceita uma vaga com a lista explícita de alimentos", () => {
    const vaga = { funcao: "liquido", obrigatoria: true, alimentos: ["leite", "ghee"] }
    expect(vagaSchema.safeParse(vaga).success).toBe(true)
  })

  it("recusa lista de alimentos vazia", () => {
    expect(
      vagaSchema.safeParse({ funcao: "liquido", obrigatoria: true, alimentos: [] }).success,
    ).toBe(false)
  })

  it("recusa alimentos junto com grupos", () => {
    const vaga = {
      funcao: "liquido",
      obrigatoria: true,
      grupos: ["laticinios"],
      alimentos: ["leite"],
    }
    expect(vagaSchema.safeParse(vaga).success).toBe(false)
  })
})

describe("preparoSchema", () => {
  it("aceita um preparo válido", () => {
    expect(preparoSchema.safeParse(preparoValido()).success).toBe(true)
  })

  it("recusa preparo sem nenhuma vaga obrigatória", () => {
    const vagas = [{ funcao: "base", obrigatoria: false }]
    expect(preparoSchema.safeParse(preparoValido({ vagas })).success).toBe(false)
  })

  it("aplica maximo = 1 quando a vaga não traz maximo", () => {
    const parsed = preparoSchema.parse(preparoValido())
    expect(parsed.vagas[0]?.maximo).toBe(1)
  })

  it("recusa título com mais de 60 caracteres e passos com mais de 400", () => {
    expect(preparoSchema.safeParse(preparoValido({ titulo: "a".repeat(61) })).success).toBe(false)
    expect(preparoSchema.safeParse(preparoValido({ passos: "a".repeat(401) })).success).toBe(false)
  })
})

describe("praticaSchema", () => {
  it("recusa chá com ingredientes vazios", () => {
    expect(praticaSchema.safeParse(praticaValida({ ingredientes: [] })).success).toBe(false)
  })

  it("aceita prática do tipo pratica com ingredientes vazios", () => {
    const pratica = praticaValida({
      tipo: "pratica",
      id: "respiracao-lenta",
      nome: "Respiração lenta",
      ingredientes: [],
    })
    expect(praticaSchema.safeParse(pratica).success).toBe(true)
  })

  it("recusa preparo com mais de 300 caracteres", () => {
    expect(praticaSchema.safeParse(praticaValida({ preparo: "a".repeat(301) })).success).toBe(false)
  })

  it("exige ao menos um estado favorecido", () => {
    expect(praticaSchema.safeParse(praticaValida({ favorece_estados: [] })).success).toBe(false)
  })
})

describe("combinacaoSchema", () => {
  const base = {
    id: "banana-com-canela",
    motivo: "Combinação doce e leve.",
    fontes,
    confianca: "media",
  }

  it("aceita itens com prefixo válido", () => {
    const itens = ["alimento:banana", "grupo:especiarias"]
    expect(combinacaoSchema.safeParse({ ...base, itens }).success).toBe(true)
  })

  it("recusa item sem prefixo", () => {
    const itens = ["abobora", "alimento:banana"]
    expect(combinacaoSchema.safeParse({ ...base, itens }).success).toBe(false)
  })

  it("recusa combinação com menos de 2 itens", () => {
    expect(combinacaoSchema.safeParse({ ...base, itens: ["alimento:banana"] }).success).toBe(false)
  })
})

describe("doshaInfoSchema, estadoInfoSchema e vocabuloGunaSchema", () => {
  it("aceita dosha com id do enum e recusa id fora dele", () => {
    const dosha = {
      id: "vata",
      nome: "Vata",
      elementos: ["ar", "éter"],
      resumo: "Movimento e leveza.",
      gunas: ["leve", "seco"],
      equilibra_gunas: ["pesado", "oleoso"],
      equilibra_rasas: ["doce"],
      caracteristicas: { corpo: "", mente: "", digestao: "" },
      desequilibra: "",
      equilibra: "",
      fontes,
    }
    expect(doshaInfoSchema.safeParse(dosha).success).toBe(true)
    expect(doshaInfoSchema.safeParse({ ...dosha, id: "ar" }).success).toBe(false)
  })

  it("aceita estado com id do enum ESTADOS", () => {
    const estado = {
      id: "com_frio",
      rotulo: "Com frio",
      emoji: "❄",
      eixo: "temperatura",
      presentes: ["frio"],
      favorecer: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar_texto: "gelados e crus",
      fontes,
      confianca: "media",
    }
    expect(estadoInfoSchema.safeParse(estado).success).toBe(true)
    expect(estadoInfoSchema.safeParse({ ...estado, id: "com_fome" }).success).toBe(false)
  })

  it("aceita vocabulário de guna com verbo nulo", () => {
    expect(
      vocabuloGunaSchema.safeParse({ guna: "quente", nome: "Quente", verbo: null }).success,
    ).toBe(true)
  })

  it("aceita grupo de evitar com id do enum", () => {
    const grupo = { id: "amendoim", nome: "Amendoim", palavras: ["amendoim"] }
    expect(grupoEvitarInfoSchema.safeParse(grupo).success).toBe(true)
    expect(grupoEvitarInfoSchema.safeParse({ ...grupo, id: "nozes" }).success).toBe(false)
  })
})

describe("incomodoSchema", () => {
  it("recusa incômodo com 2 variantes e sem pergunta", () => {
    expect(incomodoSchema.safeParse(incomodoComVariantes(2)).success).toBe(false)
  })

  it("aceita incômodo com 2 variantes e pergunta", () => {
    const incomodo = incomodoComVariantes(2, { pergunta: "Como é o incômodo?" })
    expect(incomodoSchema.safeParse(incomodo).success).toBe(true)
  })

  it("aceita variante única com id unica", () => {
    const incomodo = incomodoComVariantes(1, { variantes: [varianteValida("unica")] })
    expect(incomodoSchema.safeParse(incomodo).success).toBe(true)
  })

  it("recusa variante única com id diferente de unica", () => {
    expect(incomodoSchema.safeParse(incomodoComVariantes(1)).success).toBe(false)
  })

  it("recusa incômodo sem variantes", () => {
    expect(incomodoSchema.safeParse(incomodoComVariantes(0)).success).toBe(false)
  })
})

describe("perguntaQuizSchema", () => {
  const base = {
    id: "quiz-corpo-1",
    tema: "corpo",
    texto: "Como o corpo costuma sentir frio?",
    fontes,
  }
  const opcoesValidas = [
    { dosha: "vata", texto: "Sinto frio com facilidade." },
    { dosha: "pitta", texto: "Sinto calor com facilidade." },
    { dosha: "kapha", texto: "Sinto-me bem em qualquer clima." },
  ]

  it("aceita três opções, uma por dosha", () => {
    expect(perguntaQuizSchema.safeParse({ ...base, opcoes: opcoesValidas }).success).toBe(true)
  })

  it("recusa duas opções vata", () => {
    const opcoes = [
      { dosha: "vata", texto: "A" },
      { dosha: "vata", texto: "B" },
      { dosha: "kapha", texto: "C" },
    ]
    expect(perguntaQuizSchema.safeParse({ ...base, opcoes }).success).toBe(false)
  })

  it("recusa menos de três opções", () => {
    const opcoes = opcoesValidas.slice(0, 2)
    expect(perguntaQuizSchema.safeParse({ ...base, opcoes }).success).toBe(false)
  })
})

describe("dadosDaBaseSchema", () => {
  const vazio = {
    alimentos: [],
    preparos: [],
    praticas: [],
    combinacoes: [],
    doshas: [],
    estados: [],
    incomodos: [],
    quiz: [],
    gruposEvitar: [],
    vocabulario: [],
    fontes: [],
  }

  it("aceita as 11 listas", () => {
    expect(dadosDaBaseSchema.safeParse(vazio).success).toBe(true)
  })

  it("recusa quando falta uma das listas", () => {
    const { quiz: _quiz, ...sem } = vazio
    expect(dadosDaBaseSchema.safeParse(sem).success).toBe(false)
  })
})
