import { describe, expect, it } from "vitest"
import { derivarChas, idDoChaDerivado } from "./chas"
import type { Alimento, EstadoInfo } from "./schemas"

// Valores copiados de data/alimentos.yaml e data/estados.yaml. Core não lê YAML (R1); o
// teste com a base inteira fica no adaptador de infra.
const FONTE = [{ ref: "fonte-teste", campos: ["gunas"] }]

function erva(sobrescrita: Partial<Alimento> & Pick<Alimento, "id" | "nome">): Alimento {
  return {
    sinonimos: [],
    grupo: "especiarias",
    durabilidade: "longa",
    funcoes: ["tempero"],
    rasa: ["doce"],
    virya: "quente",
    vipaka: "doce",
    gunas: ["quente"],
    efeito: { vata: 0, pitta: 0, kapha: 0 },
    como_equilibrar: {},
    restricoes: [],
    grupos_evitar: [],
    marcas: [],
    fontes: FONTE,
    confianca: "media",
    notas: "",
    ...sobrescrita,
  }
}

const LOURO = erva({
  id: "louro",
  nome: "Louro",
  virya: "quente",
  gunas: ["quente", "leve"],
  cha: { parte: "folha" },
})
const ALECRIM = erva({
  id: "alecrim",
  nome: "Alecrim",
  virya: "quente",
  gunas: ["quente", "seco", "movel"],
  cha: { parte: "folha" },
})
const MANJERICAO = erva({
  id: "manjericao",
  nome: "Manjericão",
  virya: "frio",
  gunas: ["seco", "intenso", "leve"],
  cha: { parte: "folha" },
})
const CHA_PRETO = erva({
  id: "cha-preto",
  nome: "Chá preto",
  grupo: "bebidas",
  virya: "quente",
  gunas: ["seco", "movel"],
  marcas: ["estimulante"],
  cha: { parte: "bebida" },
})
const CHA_MATE = erva({
  id: "cha-mate",
  nome: "Chá-mate",
  grupo: "bebidas",
  virya: "quente",
  gunas: ["seco", "movel"],
  marcas: ["estimulante"],
  cha: { parte: "bebida" },
})
const CHA_VERDE = erva({
  id: "cha-verde",
  nome: "Chá verde",
  grupo: "bebidas",
  virya: "quente",
  gunas: ["seco", "movel"],
  marcas: ["estimulante"],
  cha: { parte: "bebida" },
})

function estado(
  id: EstadoInfo["id"],
  favorecer: EstadoInfo["favorecer"],
  evitar_gunas: EstadoInfo["evitar_gunas"],
  evitar_marcas: EstadoInfo["evitar_marcas"] = [],
): EstadoInfo {
  return {
    id,
    rotulo: id,
    emoji: "",
    eixo: "temperatura",
    presentes: [],
    favorecer,
    evitar_gunas,
    evitar_marcas,
    evitar_texto: "",
    fontes: FONTE,
    confianca: "media",
  }
}

const ESTADOS: EstadoInfo[] = [
  estado("com_frio", ["quente"], ["frio"]),
  estado("com_calor", ["frio", "brando"], ["quente", "intenso"]),
  estado("pesada", ["leve", "seco", "quente"], ["pesado", "oleoso"], ["fruta_doce"]),
  estado("seca", ["oleoso", "suave"], ["seco", "aspero"]),
  estado("agitada", ["estavel", "quente", "pesado"], ["movel", "frio"], ["estimulante"]),
  estado("irritada", ["frio", "brando"], ["intenso", "quente"], ["fruta_azeda", "fermentado"]),
  estado("sem_energia", ["leve", "quente", "movel"], ["pesado", "frio"], ["fruta_doce"]),
]

function chaDe(alimentos: Alimento[], id: string) {
  const cha = derivarChas(alimentos, ESTADOS).find((pratica) => pratica.id === id)
  if (!cha) throw new Error(`chá ${id} não derivado`)
  return cha
}

const TODOS_MOMENTOS = ["manha", "almoco", "tarde", "jantar", "noite"]

describe("derivarChas: tabela das seis ervas", () => {
  it.each([
    [
      "louro",
      LOURO,
      "cha-louro",
      ["com_frio", "pesada", "agitada", "sem_energia"],
      ["com_calor"],
      TODOS_MOMENTOS,
    ],
    [
      "alecrim",
      ALECRIM,
      "cha-alecrim",
      ["com_frio", "pesada", "sem_energia"],
      ["com_calor"],
      TODOS_MOMENTOS,
    ],
    [
      "manjericao",
      MANJERICAO,
      "cha-manjericao",
      ["pesada", "sem_energia"],
      ["com_frio"],
      TODOS_MOMENTOS,
    ],
    [
      "cha-preto",
      CHA_PRETO,
      "cha-preto",
      ["pesada", "sem_energia"],
      ["com_calor"],
      ["manha", "tarde"],
    ],
    [
      "cha-mate",
      CHA_MATE,
      "cha-mate",
      ["pesada", "sem_energia"],
      ["com_calor"],
      ["manha", "tarde"],
    ],
    [
      "cha-verde",
      CHA_VERDE,
      "cha-verde",
      ["pesada", "sem_energia"],
      ["com_calor"],
      ["manha", "tarde"],
    ],
  ])("%s (%s)", (_nome, alimento, id, favorece, contra, momento) => {
    const cha = chaDe([alimento], id)
    expect(cha.id).toBe(id)
    expect(cha.tipo).toBe("cha")
    expect(cha.favorece_estados).toEqual(favorece)
    expect(cha.contraindicacoes).toEqual(contra)
    expect(cha.momento).toEqual(momento)
  })
})

describe("derivarChas: nome, preparo, avisos e fontes", () => {
  it("usa Chá de <erva> quando o nome não começa com Chá e mantém o nome que já começa com Chá", () => {
    const alimentos = [LOURO, CHA_PRETO]
    expect(chaDe(alimentos, "cha-louro").nome).toBe("Chá de louro")
    expect(chaDe(alimentos, "cha-preto").nome).toBe("Chá preto")
  })

  it("monta o preparo pela parte, com o nome da erva em minúscula", () => {
    expect(chaDe([LOURO], "cha-louro").preparo).toBe(
      "Abafar louro em água quente por 5 a 10 minutos. Coar e beber morno.",
    )
    expect(chaDe([CHA_PRETO], "cha-preto").preparo).toBe("Preparar sem açúcar e beber morno.")
    const semente = erva({ id: "cominho", nome: "Cominho", cha: { parte: "semente" } })
    expect(chaDe([semente], "cha-cominho").preparo).toBe(
      "Ferver cominho em água por 5 a 10 minutos. Coar e beber morno.",
    )
  })

  it("leva o aviso de cha.aviso e vazio quando não há aviso", () => {
    const comAviso = erva({
      id: "hortela",
      nome: "Hortelã",
      cha: { parte: "folha", aviso: "Evite à noite." },
    })
    expect(chaDe([comAviso], "cha-hortela").aviso).toBe("Evite à noite.")
    expect(chaDe([LOURO], "cha-louro").aviso).toBe("")
  })

  it("acrescenta a regra da base às fontes da erva", () => {
    expect(chaDe([LOURO], "cha-louro").fontes).toEqual([
      ...FONTE,
      {
        ref: "ritu-regras-da-base",
        campos: ["gunas", "efeito", "favorece_estados", "contraindicacoes", "momento"],
      },
    ])
  })

  it("copia gunas, efeito, restrições, ingredientes e confiança da erva", () => {
    const restrita = erva({
      id: "gengibre",
      nome: "Gengibre",
      gunas: ["quente", "leve"],
      efeito: { vata: -1, pitta: 1, kapha: -1 },
      restricoes: ["vegana"],
      confianca: "alta",
      cha: { parte: "raiz" },
    })
    const cha = chaDe([restrita], "cha-gengibre")
    expect(cha.ingredientes).toEqual(["gengibre"])
    expect(cha.gunas).toEqual(["quente", "leve"])
    expect(cha.efeito).toEqual({ vata: -1, pitta: 1, kapha: -1 })
    expect(cha.nunca_sugerir_se).toEqual(["vegana"])
    expect(cha.confianca).toBe("alta")
  })
})

describe("derivarChas: regras e ids", () => {
  it("alimento sem cha não gera chá", () => {
    const semCha = erva({ id: "gengibre", nome: "Gengibre" })
    expect(derivarChas([semCha], ESTADOS)).toEqual([])
  })

  it("mantém a ordem dos alimentos e gera um chá por erva com cha", () => {
    const semCha = erva({ id: "sal", nome: "Sal" })
    const ids = derivarChas([CHA_VERDE, semCha, LOURO], ESTADOS).map((pratica) => pratica.id)
    expect(ids).toEqual(["cha-verde", "cha-louro"])
  })

  it("idDoChaDerivado não repete o prefixo cha-", () => {
    expect(idDoChaDerivado(CHA_PRETO)).toBe("cha-preto")
    expect(idDoChaDerivado(LOURO)).toBe("cha-louro")
  })

  it("é pura: a mesma entrada dá a mesma saída e não altera os alimentos", () => {
    const alimentos = [LOURO, CHA_PRETO]
    const antes = structuredClone(alimentos)
    const primeira = derivarChas(alimentos, ESTADOS)
    expect(derivarChas(alimentos, ESTADOS)).toEqual(primeira)
    expect(alimentos).toEqual(antes)
  })
})
