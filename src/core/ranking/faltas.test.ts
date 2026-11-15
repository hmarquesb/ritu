import { describe, expect, it } from "vitest"
import { notaAdequacao } from "@/core/knowledge/adequacao"
import { filtroVazio } from "@/core/knowledge/filtros"
import { createKnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento, Preparo } from "@/core/knowledge/schemas"
import type { Guna } from "@/core/knowledge/vocab"
import { createMiniKnowledge, miniDados } from "@/infra/fakes/mini-knowledge"
import { montarCandidatos } from "./candidatos"
import { escolherParaTer, faltasDoRun } from "./faltas"
import type { Candidato, EstadoNaCasa, ItemDoCandidato } from "./tipos"

const kb = createMiniKnowledge()
const ONTEM = "2026-11-14"
const HOJE = "2026-11-15"
const BUSCADAS = ["quente" as const]
const CASA_VAZIA: { confirmados: string[]; incertos: string[] } = { confirmados: [], incertos: [] }

type EntradaEscolha = Parameters<typeof escolherParaTer>[0]

function alimento(id: string): Alimento {
  const encontrado = kb.alimento(id)
  if (!encontrado) throw new Error(`alimento de teste ausente: ${id}`)
  return encontrado
}

function item(id: string, casa: EstadoNaCasa = "ausente"): ItemDoCandidato {
  return { alimento_id: id, nome: id, casa, contribui: [], linha_base: `alimentos:${id}` }
}

function pratica(id: string, adequacao: number, itens: ItemDoCandidato[]): Candidato {
  return {
    tipo: "pratica",
    id,
    nome: id,
    itens,
    contribui: [],
    linha_base: `praticas:${id}`,
    adequacao,
    nota: adequacao,
    gosta: false,
    ajudou: 0,
    novidade: false,
    no_fim: false,
  }
}

function faltas(candidatos: Candidato[], casa = CASA_VAZIA): string[] {
  return faltasDoRun({ candidatos, casa, buscadas: BUSCADAS }, kb)
}

function escolher(over: Partial<EntradaEscolha> = {}) {
  return escolherParaTer(
    {
      diasComFalta: [],
      faltasDeHoje: [],
      hoje: HOJE,
      filtro: filtroVazio,
      naLista: [],
      recusados: [],
      buscadas: BUSCADAS,
      ...over,
    },
    kb,
  )
}

describe("faltasDoRun", () => {
  it("olha só os 5 mais adequados e devolve os ausentes deles", () => {
    const ids = ["leite", "ghee", "canela", "cardamomo", "gengibre", "mel"]
    const candidatos = ids.map((id, i) => pratica(`p-${id}`, 6 - i, [item(id)]))
    // "mel" é o 6º pela adequação: fica de fora mesmo estando ausente.
    expect(faltas(candidatos)).toEqual(["leite", "ghee", "canela", "cardamomo", "gengibre"])
  })

  it("não devolve alimento que a casa tem como confirmado ou incerto", () => {
    const candidatos = [pratica("p1", 9, [item("leite"), item("ghee"), item("mel")])]
    const casa = { confirmados: ["leite"], incertos: ["ghee"] }
    expect(faltas(candidatos, casa)).toEqual(["mel"])
  })

  it("não repete um alimento que aparece em mais de um candidato", () => {
    const candidatos = [pratica("p1", 9, [item("mel")]), pratica("p2", 8, [item("mel")])]
    expect(faltas(candidatos)).toEqual(["mel"])
  })

  it("em refeição, escolhe o melhor de cada vaga obrigatória sem olhar a casa", () => {
    const [maior, menor] =
      notaAdequacao(alimento("canela"), BUSCADAS).nota >=
      notaAdequacao(alimento("gengibre"), BUSCADAS).nota
        ? ["canela", "gengibre"]
        : ["gengibre", "canela"]
    // O de maior adequação está confirmado: não vira falta, e o menor não entra no lugar dele.
    const refeicao: Candidato = {
      ...pratica("leite-morno-com-especiaria", 5, []),
      tipo: "refeicao",
      linha_base: "preparos:leite-morno-com-especiaria",
      opcoes: {
        liquido: [item("leite")],
        tempero: [item(menor), item(maior, "confirmado")],
      },
    }
    expect(faltas([refeicao], { confirmados: [maior], incertos: [] })).toEqual(["leite"])
  })

  it("não perde o alimento mais adequado de uma vaga com mais de 3 opções", () => {
    // Três opções em casa e sem qualidade buscada pontuam mais que a ausente de adequação 2.
    const gunasQuente: Guna[] = ["quente"]
    const gunasPesado: Guna[] = ["pesado"]
    const ausente: Alimento = {
      ...alimento("canela"),
      id: "x-buscado",
      nome: "X buscado",
      gunas: gunasQuente,
    }
    const outros: Alimento[] = ["x-um", "x-dois", "x-tres"].map((id) => ({
      ...alimento("canela"),
      id,
      nome: id,
      gunas: gunasPesado,
    }))
    const preparo: Preparo = {
      id: "cha-de-teste",
      nome: "Chá de teste",
      titulo: "Chá com {tempero}",
      passos: "Misture {tempero}.",
      vagas: [{ funcao: "tempero", obrigatoria: true, maximo: 1 }],
      gunas_do_preparo: gunasQuente,
      momento: ["tarde"],
      contraindicacoes: [],
      fontes: [{ ref: "fonte-teste", campos: [] }],
      confianca: "alta",
    }
    const kbTeste = createKnowledgeBase(
      {
        ...miniDados,
        alimentos: [ausente, ...outros],
        combinacoes: [],
        praticas: [],
        preparos: [preparo],
      },
      { cobertura: false },
    )
    const casa = { confirmados: outros.map((o) => o.id), incertos: [] }
    const candidatos = montarCandidatos(
      {
        qualidades: {
          presentes: [],
          buscadas: BUSCADAS,
          evitar_gunas: [],
          evitar_marcas: [],
          evitar: [],
          conflitos: [],
          linhas_base: [],
        },
        estados: [],
        momento_do_dia: "tarde",
        filtro: filtroVazio,
        restricoes: [],
        casa,
        preferencias: [],
        sugeridos_hoje: [],
      },
      kbTeste,
    )
    expect(faltasDoRun({ candidatos, casa, buscadas: BUSCADAS }, kbTeste)).toEqual(["x-buscado"])
  })
})

describe("escolherParaTer", () => {
  it("soma o dia de hoje a quem faltou hoje e devolve o alimento com linha_base", () => {
    const escolhido = escolher({
      diasComFalta: [{ alimento_id: "leite", dias: 2, ultimo_dia: ONTEM }],
      faltasDeHoje: ["leite"],
    })
    expect(escolhido).toMatchObject({
      alimento_id: "leite",
      nome: "Leite",
      vezes: 3,
      linha_base: "alimentos:leite",
    })
  })

  it("não soma duas vezes quem já tem falta de hoje", () => {
    const escolhido = escolher({
      diasComFalta: [{ alimento_id: "leite", dias: 3, ultimo_dia: HOJE }],
      faltasDeHoje: ["leite"],
    })
    expect(escolhido?.vezes).toBe(3)
  })

  it("exige pelo menos 3 dias", () => {
    const escolhido = escolher({
      diasComFalta: [{ alimento_id: "leite", dias: 2, ultimo_dia: ONTEM }],
    })
    expect(escolhido).toBeUndefined()
  })

  it("tira o alimento que reprova no filtro", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "leite", dias: 5, ultimo_dia: ONTEM },
        { alimento_id: "mel", dias: 3, ultimo_dia: ONTEM },
      ],
      filtro: { ...filtroVazio, nao_come: ["leite"] },
    })
    expect(escolhido?.alimento_id).toBe("mel")
  })

  it("tira o alimento que já está na lista", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "leite", dias: 5, ultimo_dia: ONTEM },
        { alimento_id: "mel", dias: 3, ultimo_dia: ONTEM },
      ],
      naLista: ["leite"],
    })
    expect(escolhido?.alimento_id).toBe("mel")
  })

  it("tira o alimento recusado", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "leite", dias: 5, ultimo_dia: ONTEM },
        { alimento_id: "mel", dias: 3, ultimo_dia: ONTEM },
      ],
      recusados: ["leite"],
    })
    expect(escolhido?.alimento_id).toBe("mel")
  })

  it("desempata pelo que tem mais dias", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "leite", dias: 4, ultimo_dia: ONTEM },
        { alimento_id: "ghee", dias: 5, ultimo_dia: ONTEM },
      ],
    })
    expect(escolhido?.alimento_id).toBe("ghee")
  })

  it("desempata pelo último dia mais recente", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "leite", dias: 3, ultimo_dia: "2026-11-10" },
        { alimento_id: "ghee", dias: 3, ultimo_dia: ONTEM },
      ],
    })
    expect(escolhido?.alimento_id).toBe("ghee")
  })

  it("desempata pelo nome menor", () => {
    const escolhido = escolher({
      diasComFalta: [
        { alimento_id: "cardamomo", dias: 3, ultimo_dia: ONTEM },
        { alimento_id: "canela", dias: 3, ultimo_dia: ONTEM },
      ],
    })
    expect(escolhido?.nome).toBe("Canela")
  })
})
