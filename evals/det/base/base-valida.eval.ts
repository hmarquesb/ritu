import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { validarBase } from "@/core/knowledge/knowledge-base"
import { getContainer, readKnowledgeData } from "@/infra/container"

const ALIMENTOS = [
  "banana",
  "maca",
  "pera",
  "mamao",
  "manga",
  "laranja",
  "tangerina",
  "limao",
  "abacate",
  "abacaxi",
  "melancia",
  "melao",
  "uva",
  "morango",
  "goiaba",
  "maracuja",
  "caqui",
  "coco",
  "tamara",
  "uva-passa",
  "ameixa-seca",
  "couve",
  "espinafre",
  "alface",
  "rucula",
  "agriao",
  "repolho",
  "acelga",
  "escarola",
  "abobora",
  "abobrinha",
  "quiabo",
  "tomate",
  "pepino",
  "vagem",
  "berinjela",
  "pimentao",
  "brocolis",
  "couve-flor",
  "milho-verde",
  "ervilha",
  "cenoura",
  "beterraba",
  "batata-doce",
  "batata",
  "mandioca",
  "inhame",
  "nabo",
  "rabanete",
  "arroz-branco",
  "arroz-integral",
  "aveia",
  "fuba",
  "cuscuz-de-milho",
  "canjica",
  "tapioca",
  "farinha-de-mandioca",
  "pao",
  "macarrao",
  "quinoa",
  "feijao-preto",
  "feijao-carioca",
  "feijao-fradinho",
  "lentilha",
  "lentilha-vermelha",
  "grao-de-bico",
  "feijao-mungo",
  "ervilha-partida",
  "tofu",
  "leite",
  "iogurte-natural",
  "queijo-minas",
  "ricota",
  "manteiga",
  "ovo",
  "castanha-de-caju",
  "castanha-do-para",
  "amendoa",
  "noz",
  "amendoim",
  "gergelim",
  "linhaca",
  "chia",
  "semente-de-girassol",
  "semente-de-abobora",
  "ghee",
  "azeite",
  "oleo-de-coco",
  "oleo-de-gergelim",
  "oleo-de-girassol",
  "gengibre",
  "canela",
  "cardamomo",
  "cominho",
  "coentro-em-grao",
  "erva-doce",
  "curcuma",
  "pimenta-do-reino",
  "cravo",
  "noz-moscada",
  "mostarda-em-grao",
  "louro",
  "anis-estrelado",
  "pimenta-fresca",
  "hortela",
  "camomila",
  "capim-limao",
  "erva-cidreira",
  "coentro-fresco",
  "salsinha",
  "cebolinha",
  "manjericao",
  "alecrim",
  "oregano",
  "alho",
  "cebola",
  "sal",
  "mel",
  "acucar-mascavo",
  "rapadura",
  "melado",
  "agua-de-coco",
  "leite-de-coco",
  "cafe",
  "cha-preto",
  "cha-mate",
  "cha-verde",
]

const PREPAROS = [
  "mingau",
  "sopa",
  "sopa-creme",
  "caldo",
  "arroz-papa",
  "arroz-com-legume",
  "kitchari",
  "leguminosa-cozida",
  "arroz-com-leguminosa",
  "refogado",
  "folhas-refogadas",
  "legumes-no-vapor",
  "legumes-assados",
  "pure-de-raiz",
  "raiz-cozida",
  "salada-morna",
  "salada-crua",
  "fruta-cozida-com-especiaria",
  "fruta-assada",
  "fruta-fresca",
  "ovo-mexido",
  "omelete-com-legume",
  "leite-morno-com-especiaria",
  "iogurte-batido-com-especiaria",
  "tapioca-recheada",
  "cuscuz-no-vapor",
  "torrada-com-gordura",
  "macarrao-com-legume",
  "polenta-mole",
  "oleaginosas-de-molho",
]

const CHAS = [
  "cha-gengibre",
  "cha-gengibre-canela",
  "cha-gengibre-limao-mel",
  "cha-canela",
  "cha-canela-cardamomo",
  "cha-cardamomo",
  "cha-cravo-canela",
  "cha-erva-doce",
  "cha-cominho-coentro-erva-doce",
  "cha-coentro-em-grao",
  "cha-hortela",
  "cha-hortela-erva-doce",
  "cha-camomila",
  "cha-camomila-erva-doce",
  "cha-capim-limao",
  "cha-capim-limao-hortela",
  "cha-erva-cidreira",
  "cha-curcuma-gengibre",
  "cha-anis-estrelado",
]

const OLEOS = [
  "oleo-pes-gergelim",
  "oleo-pes-coco",
  "oleo-barriga-gergelim",
  "oleo-corpo-gergelim",
  "oleo-corpo-coco",
  "oleo-corpo-girassol",
  "oleo-couro-cabeludo-coco",
]

const PRATICAS = [
  "agua-morna-com-limao",
  "agua-morna-ao-acordar",
  "agua-morna-ao-longo-do-dia",
  "caminhada-leve-apos-refeicao",
  "caminhada-leve-de-manha",
  "respiracao-lenta",
  "pausa-em-silencio",
  "alongamento-leve",
  "pes-aquecidos",
  "escalda-pes-morno",
  "banho-morno",
  "rosto-com-agua-fresca",
  "bolsa-morna-na-barriga",
  "comer-sentada-sem-tela",
  "almoco-como-refeicao-principal",
  "jantar-leve-e-cedo",
  "telas-desligadas-antes-de-dormir",
  "dormir-cedo",
]

const dados = readKnowledgeData()
const ids = (itens: { id: string }[]) => itens.map((i) => i.id).sort()
const ordenado = (xs: string[]) => [...xs].sort()

describe("base real: validação", () => {
  it("passa em validarBase sem erros", () => {
    expect(validarBase(dados).erros).toEqual([])
  })

  it("o container carrega a mesma base de data/", () => {
    const { knowledge } = getContainer()
    expect(knowledge.alimentos.length).toBe(dados.alimentos.length)
    expect(knowledge.preparos.length).toBe(dados.preparos.length)
    expect(knowledge.praticas.length).toBe(dados.praticas.length)
  })
})

describe("base real: ids esperados", () => {
  it("os 130 alimentos são exatamente a lista", () => {
    expect(ids(dados.alimentos)).toEqual(ordenado(ALIMENTOS))
  })

  it("os 30 preparos são exatamente a lista", () => {
    expect(ids(dados.preparos)).toEqual(ordenado(PREPAROS))
  })

  it("os chás são exatamente a lista", () => {
    expect(ids(dados.praticas.filter((p) => p.tipo === "cha"))).toEqual(ordenado(CHAS))
  })

  it("os óleos são exatamente a lista", () => {
    expect(ids(dados.praticas.filter((p) => p.tipo === "oleo"))).toEqual(ordenado(OLEOS))
  })

  it("as práticas são exatamente a lista", () => {
    expect(ids(dados.praticas.filter((p) => p.tipo === "pratica"))).toEqual(ordenado(PRATICAS))
  })
})

describe("base real: mínimos de config.base", () => {
  const { base } = config

  it("alimentos, preparos e combinações atingem o mínimo", () => {
    expect(dados.alimentos.length).toBeGreaterThanOrEqual(base.minAlimentos)
    expect(dados.preparos.length).toBeGreaterThanOrEqual(base.minPreparos)
    expect(dados.combinacoes.length).toBeGreaterThanOrEqual(base.minCombinacoes)
  })

  it("chás, óleos e práticas atingem o mínimo de cada tipo", () => {
    const contar = (tipo: string) => dados.praticas.filter((p) => p.tipo === tipo).length
    expect(contar("cha")).toBeGreaterThanOrEqual(base.minPraticas.cha)
    expect(contar("oleo")).toBeGreaterThanOrEqual(base.minPraticas.oleo)
    expect(contar("pratica")).toBeGreaterThanOrEqual(base.minPraticas.pratica)
  })
})
