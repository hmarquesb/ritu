import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { type DemoSeed, demoSeedSchema, validarSeed } from "./demo-seed"

type Historico = DemoSeed["historico"][number]

const kb = createMiniKnowledge()
const agora = new Date("2026-11-16T12:00:00.000-03:00")

function conversa(
  dias_atras: number,
  mensagem: string,
  resultados: Historico["resultados"],
): Historico {
  return {
    dias_atras,
    mensagem,
    estados: ["com_frio"],
    momento_do_dia: "manha",
    gunas_buscadas: ["quente"],
    saida: {
      origem: "agente",
      resposta: "Um chá morno de gengibre combina com o frio da manhã.",
      geral: false,
      avisos: [],
      explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
      sugestoes: [
        {
          tipo: "cha",
          pratica_id: "cha-gengibre",
          titulo: "Chá de gengibre",
          como_fazer: "Ferva água com fatias de gengibre e bebe morno.",
          itens: [
            {
              alimento_id: "gengibre",
              nome: "Gengibre",
              contribui: ["quente"],
              verbos: [],
              linha_base: "alimentos:gengibre",
              casa: "confirmado",
            },
          ],
          verbos: [],
          motivo: "Aquece o começo do dia.",
          linhas_base: [],
          novidade: false,
        },
      ],
      evitar: [],
      incertos: [],
      citados: ["alimentos:gengibre"],
      anotacoes: [],
      propostas: [],
    },
    resultados,
  }
}

function seedValido(): DemoSeed {
  return {
    faixa: "Manhã fria, com a casa com canela, mel e gengibre",
    mensagem_sugerida: "Estou com frio e sem energia hoje cedo",
    perfil: {
      prakriti: { vata: 0.5, pitta: 0.3, kapha: 0.2 },
      cidade: { nome: "Curitiba", lat: -25.43, lon: -49.27, fuso: "America/Sao_Paulo" },
      evitar_sempre: [{ tipo: "grupo", valor: "leite" }],
      restricoes: [],
      nao_come: [{ tipo: "texto", valor: "fígado" }],
    },
    casa: [
      { alimento_id: "canela", dias_atras: 5 },
      { alimento_id: "mel", dias_atras: 10 },
      { alimento_id: "arroz-branco", dias_atras: 30 },
      { alimento_id: "cardamomo", dias_atras: 60 },
      { alimento_id: "gengibre", dias_atras: 3 },
      { alimento_id: "cenoura", dias_atras: 4 },
      { alimento_id: "banana", dias_atras: 9 },
      { alimento_id: "limao", dias_atras: 7 },
    ],
    preferencias: [
      { tipo: "alimento", id: "gengibre", gosto: "gosta" },
      { tipo: "pratica", id: "cha-gengibre", ajudou: 3, nao_ajudou: 0 },
      { tipo: "preparo", id: "pure-de-raiz", nao_fez: 1 },
    ],
    faltas: [
      { alimento_id: "abobora", dias_atras: 1 },
      { alimento_id: "abobora", dias_atras: 3 },
      { alimento_id: "abobora", dias_atras: 6 },
    ],
    rotina: ["Caminhada leve antes do café"],
    padrao: {
      estados: ["com_frio"],
      item: { tipo: "pratica", id: "cha-gengibre" },
      ocorrencias: 3,
    },
    historico: [
      conversa(1, "Estou com frio de manhã", ["ajudou"]),
      conversa(2, "Acordei com frio de novo", ["ajudou"]),
      conversa(3, "Frio outra vez hoje cedo", ["ajudou"]),
      conversa(4, "Hoje a manhã está fria", ["aguardando"]),
      conversa(5, "Vou tentar o chá de novo", ["aguardando"]),
    ],
  }
}

// Acesso a uma conversa do fixture: o seed válido sempre tem as cinco.
function conversaNo(seed: DemoSeed, i: number): Historico {
  const conversa = seed.historico[i]
  if (!conversa) throw new Error(`o seed não tem a conversa ${i}`)
  return conversa
}

function errosDe(seed: DemoSeed): string[] {
  return validarSeed(seed, kb, agora)
}

function expectErro(seed: DemoSeed, trecho: string): void {
  expect(errosDe(seed).some((erro) => erro.includes(trecho))).toBe(true)
}

describe("validarSeed", () => {
  it("aceita um seed válido", () => {
    expect(errosDe(seedValido())).toEqual([])
  })

  it("acusa id que não existe na base", () => {
    const seed = seedValido()
    seed.casa.push({ alimento_id: "nao-existe", dias_atras: 1 })
    expectErro(seed, "nao-existe")
  })

  it("acusa item de casa que bate em evitar_sempre", () => {
    const seed = seedValido()
    seed.casa.push({ alimento_id: "leite", dias_atras: 2 })
    expectErro(seed, "leite")
  })

  it("acusa sugestão que bate em evitar_sempre", () => {
    const seed = seedValido()
    const [sugestao] = conversaNo(seed, 0).saida.sugestoes
    const [item] = sugestao?.itens ?? []
    if (item) item.alimento_id = "leite"
    expectErro(seed, "leite")
  })

  it("acusa resultados com tamanho diferente das sugestões", () => {
    const seed = seedValido()
    conversaNo(seed, 0).resultados = []
    expectErro(seed, "resultados")
  })

  it("acusa casa com menos de 5 itens confirmados", () => {
    const seed = seedValido()
    seed.casa = seed.casa.filter((item) => !["canela", "mel"].includes(item.alimento_id))
    expectErro(seed, "confirmados")
  })

  it("acusa casa com menos de 2 itens incertos", () => {
    const seed = seedValido()
    const banana = seed.casa.find((item) => item.alimento_id === "banana")
    if (banana) banana.dias_atras = 2
    expectErro(seed, "incertos")
  })

  it("acusa falta que não se repete em 3 dias diferentes", () => {
    const seed = seedValido()
    seed.faltas = seed.faltas.map((falta) => ({ ...falta, dias_atras: 2 }))
    expectErro(seed, "faltas")
  })

  it("acusa menos de 2 retornos aguardando", () => {
    const seed = seedValido()
    conversaNo(seed, 4).resultados = ["nao_fez"]
    expectErro(seed, "aguardando")
  })

  it("acusa menos de 3 conversas com o padrão ajudou", () => {
    const seed = seedValido()
    conversaNo(seed, 0).resultados = ["nao_ajudou"]
    expectErro(seed, "padrão")
  })

  it("acusa mensagem que cita um incômodo", () => {
    const seed = seedValido()
    conversaNo(seed, 0).mensagem = "Estou com dor de cabeça desde cedo"
    expectErro(seed, "incômodo")
  })

  it("acusa texto com < ou >", () => {
    const seed = seedValido()
    seed.mensagem_sugerida = "<b>oi</b>"
    expectErro(seed, "< ou >")
  })
})

describe("demoSeedSchema", () => {
  it("recusa chave a mais no seed", () => {
    expect(demoSeedSchema.safeParse({ ...seedValido(), extra: 1 }).success).toBe(false)
  })

  it("aceita o padrão de chá sem id e recusa o id junto do tipo cha", () => {
    const comCha = { ...seedValido(), padrao: { ...seedValido().padrao, item: { tipo: "cha" } } }
    expect(demoSeedSchema.safeParse(comCha).success).toBe(true)
    const comId = { ...comCha, padrao: { ...comCha.padrao, item: { tipo: "cha", id: "x" } } }
    expect(demoSeedSchema.safeParse(comId).success).toBe(false)
  })
})

describe("padrão de chá", () => {
  function seedComCha(): DemoSeed {
    const seed = seedValido()
    seed.padrao.item = { tipo: "cha" }
    return seed
  }

  it("aceita um padrão de chá sem conferir id na base", () => {
    expect(errosDe(seedComCha())).toEqual([])
  })

  it("exige 3 conversas com chá ajudou também no padrão de chá", () => {
    const seed = seedComCha()
    conversaNo(seed, 0).resultados = ["nao_ajudou"]
    expectErro(seed, "padrão")
  })

  it("não conta sugestão que não é chá, mesmo que tenha sido ajudou", () => {
    const seed = seedComCha()
    for (const i of [0, 1, 2]) {
      const [sugestao] = conversaNo(seed, i).saida.sugestoes
      if (sugestao) sugestao.pratica_id = "escalda-pes-morno"
    }
    expectErro(seed, "padrão")
  })
})
