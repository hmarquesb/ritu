import { describe, expect, it } from "vitest"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { createKnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Pratica, Preparo, Vaga } from "@/core/knowledge/schemas"
import type { Preferencia } from "@/core/preferences/ports"
import { miniDados } from "@/infra/fakes/mini-knowledge"
import { cortarParaOContexto, montarCandidatos } from "./candidatos"
import type { Candidato, TipoDeSugestao } from "./tipos"

type Entrada = Parameters<typeof montarCandidatos>[0]

const FONTE = [{ ref: "fonte-teste", campos: [] }]
const CONFIANCA = "alta" as const
const SUGERIDO_EM = "2026-11-10T10:00:00.000Z"

function pratica(over: Partial<Pratica> & Pick<Pratica, "id" | "ingredientes">): Pratica {
  return {
    tipo: "pratica",
    nome: over.id,
    preparo: "Faça devagar.",
    gunas: ["quente", "estavel"],
    favorece_estados: ["com_frio"],
    efeito: { vata: 0, pitta: 0, kapha: 0 },
    momento: [],
    contraindicacoes: [],
    nunca_sugerir_se: [],
    aviso: "",
    fontes: FONTE,
    confianca: CONFIANCA,
    ...over,
  }
}

function preparo(over: Partial<Preparo> & Pick<Preparo, "id" | "vagas">): Preparo {
  // O título e os passos precisam citar cada vaga obrigatória, como exige a base.
  const lacunas = over.vagas
    .filter((v) => v.obrigatoria)
    .map((v) => `{${v.funcao}}`)
    .join(" e ")
  return {
    nome: over.id,
    titulo: `Refeição com ${lacunas}`,
    passos: `Misture ${lacunas}.`,
    gunas_do_preparo: ["quente", "estavel"],
    momento: ["tarde"],
    contraindicacoes: [],
    fontes: FONTE,
    confianca: CONFIANCA,
    ...over,
  }
}

function vaga(funcao: Vaga["funcao"], over: Partial<Vaga> = {}): Vaga {
  return { funcao, obrigatoria: true, maximo: 1, ...over }
}

function kbCom(praticas: Pratica[], preparos: Preparo[] = []) {
  return createKnowledgeBase({ ...miniDados, praticas, preparos }, { cobertura: false })
}

function entrada(over: Partial<Entrada> = {}): Entrada {
  return {
    qualidades: {
      presentes: [],
      buscadas: ["quente", "estavel"],
      evitar_gunas: [],
      evitar_marcas: [],
      evitar: [],
      conflitos: [],
      linhas_base: [],
    },
    estados: ["com_frio"],
    momento_do_dia: "tarde",
    filtro: { ...filtroVazio },
    restricoes: [],
    casa: { confirmados: [], incertos: [] },
    preferencias: [],
    sugeridos_hoje: [],
    ...over,
  }
}

function preferencia(
  item_tipo: Preferencia["item_tipo"],
  item_id: string,
  over: Partial<Preferencia> = {},
): Preferencia {
  return {
    conta_id: "conta-1",
    item_tipo,
    item_id,
    gosto: null,
    ajudou: 0,
    nao_ajudou: 0,
    nao_fez: 0,
    ultimos_resultados: [],
    ultima_sugestao_em: null,
    ...over,
  }
}

const ids = (candidatos: Candidato[]): string[] => candidatos.map((c) => c.id)

const CONTROLE = pratica({ id: "controle", ingredientes: ["gengibre"] })

// Monta com a prática de controle (sempre passa) e confere quem sobrou.
function idsComControle(alvo: Pratica, over: Partial<Entrada> = {}): string[] {
  return ids(montarCandidatos(entrada(over), kbCom([CONTROLE, alvo])))
}

describe("quem entra no ranking", () => {
  const filtroComRestricao: FiltroPessoa = { ...filtroVazio, restricoes: ["vegana"] }

  it("sai a prática que reprova no filtro da pessoa", () => {
    const alvo = pratica({ id: "x", ingredientes: ["leite"] })
    expect(idsComControle(alvo, { filtro: filtroComRestricao })).toEqual(["controle"])
  })

  it("sai a prática com contraindicação em comum com os estados", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"], contraindicacoes: ["com_calor"] })
    expect(idsComControle(alvo, { estados: ["com_calor"] })).toEqual(["controle"])
  })

  it("sai a prática que não serve ao momento do dia", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"], momento: ["noite"] })
    expect(idsComControle(alvo, { momento_do_dia: "tarde" })).toEqual(["controle"])
  })

  it("sai a prática com nunca_sugerir_se em comum com as restrições", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"], nunca_sugerir_se: ["vegana"] })
    expect(idsComControle(alvo, { restricoes: ["vegana"] })).toEqual(["controle"])
  })

  it("sai a prática com ingrediente de marca evitada", () => {
    const alvo = pratica({ id: "x", ingredientes: ["limao"] })
    const qualidades: Entrada["qualidades"] = {
      presentes: [],
      buscadas: ["quente", "estavel"],
      evitar_gunas: [],
      evitar_marcas: ["fruta_azeda"],
      evitar: [],
      conflitos: [],
      linhas_base: [],
    }
    expect(idsComControle(alvo, { qualidades })).toEqual(["controle"])
  })

  it("sai a prática que a pessoa não gosta", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"] })
    const preferencias = [preferencia("pratica", "x", { gosto: "nao_gosta" })]
    expect(idsComControle(alvo, { preferencias })).toEqual(["controle"])
  })

  it("sai a prática já sugerida hoje, no formato praticas:<id>", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"] })
    expect(idsComControle(alvo, { sugeridos_hoje: ["praticas:x"] })).toEqual(["controle"])
  })

  it("sugerido hoje com preparos:<id> não tira a prática de mesmo id", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"] })
    expect(idsComControle(alvo, { sugeridos_hoje: ["preparos:x"] })).toEqual(["controle", "x"])
  })

  it("prática com momento vazio serve a qualquer momento do dia", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"], momento: [] })
    expect(idsComControle(alvo, { momento_do_dia: "manha" })).toEqual(["controle", "x"])
  })

  it("sai a prática com adequação menor ou igual a zero", () => {
    const alvo = pratica({ id: "x", ingredientes: ["gengibre"], gunas: ["frio"] })
    expect(idsComControle(alvo)).toEqual(["controle"])
  })

  it("preparo sem opção numa vaga obrigatória sai", () => {
    const semLiquido = preparo({
      id: "sem-liquido",
      vagas: [vaga("liquido", { grupos: ["laticinios"] })],
    })
    const comManteiga = preparo({ id: "com-manteiga", vagas: [vaga("gordura")] })
    const filtro: FiltroPessoa = {
      ...filtroVazio,
      nao_come: ["leite", "iogurte-natural", "ghee"],
    }
    const candidatos = montarCandidatos(
      entrada({ filtro }),
      kbCom([CONTROLE], [semLiquido, comManteiga]),
    )
    expect(ids(candidatos)).toEqual(["com-manteiga", "controle"])
  })

  it("vaga opcional sem opção não tira o preparo", () => {
    const comOpcional = preparo({
      id: "com-opcional",
      vagas: [vaga("gordura"), vaga("liquido", { obrigatoria: false, grupos: ["laticinios"] })],
    })
    const filtro: FiltroPessoa = {
      ...filtroVazio,
      nao_come: ["leite", "iogurte-natural", "ghee"],
    }
    const candidatos = montarCandidatos(entrada({ filtro }), kbCom([], [comOpcional]))
    expect(ids(candidatos)).toEqual(["com-opcional"])
  })
})

describe("ordenação dentro do tipo", () => {
  it("confirmado em casa fica acima de incerto, e incerto acima de ausente", () => {
    const candidatos = montarCandidatos(
      entrada({ casa: { confirmados: ["mel"], incertos: ["gengibre"] } }),
      kbCom([
        pratica({ id: "c", ingredientes: ["canela"] }),
        pratica({ id: "b", ingredientes: ["gengibre"] }),
        pratica({ id: "a", ingredientes: ["mel"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["a", "b", "c"])
  })

  it("'gosta' sobe a prática", () => {
    const candidatos = montarCandidatos(
      entrada({ preferencias: [preferencia("pratica", "b", { gosto: "gosta" })] }),
      kbCom([
        pratica({ id: "a", ingredientes: ["gengibre"] }),
        pratica({ id: "b", ingredientes: ["gengibre"] }),
        pratica({ id: "c", ingredientes: ["gengibre"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["b", "a", "c"])
  })

  it("cada 'ajudou' sobe a prática até o teto", () => {
    const candidatos = montarCandidatos(
      entrada({
        preferencias: [
          preferencia("pratica", "a", { ajudou: 2 }),
          preferencia("pratica", "b", { ajudou: 3 }),
          preferencia("pratica", "c", { ajudou: 10 }),
        ],
      }),
      kbCom([
        pratica({ id: "a", ingredientes: ["gengibre"] }),
        pratica({ id: "b", ingredientes: ["gengibre"] }),
        pratica({ id: "c", ingredientes: ["gengibre"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["b", "c", "a"])
  })

  it("dois 'não ajudou' mais recentes mandam para o fim, mesmo com 'ajudou' antigos", () => {
    const candidatos = montarCandidatos(
      entrada({
        preferencias: [
          preferencia("pratica", "a", {
            ajudou: 5,
            nao_ajudou: 2,
            ultimos_resultados: ["nao_ajudou", "nao_ajudou"],
          }),
          preferencia("pratica", "b", { nao_ajudou: 1, ultimos_resultados: ["nao_ajudou"] }),
        ],
      }),
      kbCom([
        pratica({ id: "a", ingredientes: ["gengibre"] }),
        pratica({ id: "b", ingredientes: ["gengibre"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["b", "a"])
  })

  it("opções de uma vaga: a de casa confirmada vem primeiro e a lista tem até 3", () => {
    const refeicao = preparo({
      id: "refeicao",
      gunas_do_preparo: ["quente"],
      vagas: [vaga("gordura")],
    })
    const [candidato] = montarCandidatos(
      entrada({
        qualidades: {
          presentes: [],
          buscadas: ["quente"],
          evitar_gunas: [],
          evitar_marcas: [],
          evitar: [],
          conflitos: [],
          linhas_base: [],
        },
        casa: { confirmados: ["ghee"], incertos: [] },
      }),
      kbCom([], [refeicao]),
    )
    expect(candidato?.itens[0]?.alimento_id).toBe("ghee")
    expect(candidato?.opcoes?.gordura?.map((i) => i.alimento_id)).toEqual([
      "ghee",
      "manteiga",
      "oleo-de-gergelim",
    ])
  })
})

describe("novidade", () => {
  const casaDeMel = { confirmados: ["mel"], incertos: [] }
  const praticasDeMel = ["p1", "p2", "p3", "p4", "p5"].map((id) =>
    pratica({ id, ingredientes: ["mel"] }),
  )

  it("no máximo uma novidade, só com sugestão registrada, e na 3ª posição do tipo", () => {
    const preferencias = ["p1", "p2", "p3", "p4"].map((id) =>
      preferencia("pratica", id, { gosto: "gosta", ultima_sugestao_em: SUGERIDO_EM }),
    )
    const candidatos = montarCandidatos(
      entrada({ casa: casaDeMel, preferencias }),
      kbCom(praticasDeMel),
    )
    expect(ids(candidatos)).toEqual(["p1", "p2", "p5", "p3", "p4"])
    expect(candidatos.filter((c) => c.novidade).map((c) => c.id)).toEqual(["p5"])
  })

  it("sem nenhuma sugestão registrada não há novidade", () => {
    const preferencias = ["p1", "p2", "p3", "p4"].map((id) =>
      preferencia("pratica", id, { gosto: "gosta" }),
    )
    const candidatos = montarCandidatos(
      entrada({ casa: casaDeMel, preferencias }),
      kbCom(praticasDeMel),
    )
    expect(ids(candidatos)).toEqual(["p1", "p2", "p3", "p4", "p5"])
    expect(candidatos.some((c) => c.novidade)).toBe(false)
  })
})

describe("contribui e adequação", () => {
  it("prática: contribui são as gunas dela que estão em buscadas", () => {
    const [c] = montarCandidatos(
      entrada(),
      kbCom([pratica({ id: "x", ingredientes: ["gengibre"], gunas: ["quente", "leve"] })]),
    )
    expect(c?.contribui).toEqual(["quente"])
  })

  it("refeição: contribui junta as gunas do preparo e dos itens, sem repetir", () => {
    const refeicao = preparo({ id: "r", vagas: [vaga("gordura")] })
    const [c] = montarCandidatos(entrada(), kbCom([], [refeicao]))
    expect(c?.itens[0]?.alimento_id).toBe("ghee")
    expect(c?.contribui).toEqual(["quente", "estavel"])
  })

  it("refeição: adequação é a nota do preparo mais a média, com uma casa, das 1ªs opções obrigatórias", () => {
    const refeicao = preparo({
      id: "r",
      gunas_do_preparo: ["quente"],
      vagas: [vaga("gordura"), vaga("tempero"), vaga("adocante")],
    })
    const [c] = montarCandidatos(
      entrada({ qualidades: { ...entrada().qualidades, buscadas: ["quente"] } }),
      kbCom([], [refeicao]),
    )
    // Nota do preparo: 2. Primeiras opções: gordura 0, tempero 2, adocante 0. Média 0,67 → 0,7.
    expect(c?.adequacao).toBeCloseTo(2.7, 5)
  })
})

describe("desempates e no_fim", () => {
  it("empate de nota: a adequação maior vem antes", () => {
    const candidatos = montarCandidatos(
      entrada({
        casa: { confirmados: ["mel"], incertos: [] },
        preferencias: [preferencia("pratica", "a", { gosto: "gosta" })],
      }),
      kbCom([
        pratica({ id: "z", ingredientes: ["mel"] }),
        pratica({ id: "a", ingredientes: ["mel"], gunas: ["quente"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["z", "a"])
  })

  it("empate de nota e de adequação: o id decide", () => {
    const candidatos = montarCandidatos(
      entrada(),
      kbCom([
        pratica({ id: "b", ingredientes: ["gengibre"] }),
        pratica({ id: "a", ingredientes: ["gengibre"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["a", "b"])
  })

  it("no_fim vai para depois dos demais, mesmo com nota maior, e os demais seguem a nota", () => {
    const candidatos = montarCandidatos(
      entrada({
        casa: { confirmados: ["mel"], incertos: [] },
        preferencias: [
          preferencia("pratica", "a", {
            gosto: "gosta",
            ajudou: 3,
            nao_ajudou: 2,
            ultimos_resultados: ["nao_ajudou", "nao_ajudou"],
          }),
        ],
      }),
      kbCom([
        pratica({ id: "a", ingredientes: ["mel"] }),
        pratica({ id: "b", ingredientes: ["mel"] }),
        pratica({ id: "c", ingredientes: ["mel"], gunas: ["quente"] }),
      ]),
    )
    expect(ids(candidatos)).toEqual(["b", "c", "a"])
    expect(candidatos.find((c) => c.id === "a")?.no_fim).toBe(true)
  })
})

describe("novidade: exclusões e posição", () => {
  const sugerida = (id: string) =>
    preferencia("pratica", id, { gosto: "gosta", ultima_sugestao_em: SUGERIDO_EM })

  it("candidato com ingrediente ausente não vira novidade", () => {
    const candidatos = montarCandidatos(
      entrada({ preferencias: [sugerida("p1")] }),
      kbCom([
        pratica({ id: "p1", ingredientes: ["mel"] }),
        pratica({ id: "p2", ingredientes: ["canela"] }),
      ]),
    )
    expect(candidatos.some((c) => c.novidade)).toBe(false)
  })

  it("candidato com adequação abaixo do mínimo não vira novidade", () => {
    const candidatos = montarCandidatos(
      entrada({
        casa: { confirmados: ["mel"], incertos: [] },
        preferencias: [sugerida("p1")],
      }),
      kbCom([
        pratica({ id: "p1", ingredientes: ["mel"] }),
        pratica({ id: "p2", ingredientes: ["mel"], gunas: ["quente"] }),
      ]),
    )
    expect(candidatos.some((c) => c.novidade)).toBe(false)
  })

  it("novidade já acima da 3ª posição não desce", () => {
    const candidatos = montarCandidatos(
      entrada({
        casa: { confirmados: ["mel"], incertos: [] },
        preferencias: [
          preferencia("pratica", "n", { gosto: "gosta" }),
          sugerida("s1"),
          sugerida("s2"),
          sugerida("s3"),
        ],
      }),
      kbCom(["n", "s1", "s2", "s3"].map((id) => pratica({ id, ingredientes: ["mel"] }))),
    )
    expect(ids(candidatos)).toEqual(["n", "s1", "s2", "s3"])
    expect(candidatos[0]?.novidade).toBe(true)
  })
})

describe("opções de vaga: marca evitada e filtro", () => {
  const refeicaoComLiquido = preparo({
    id: "r",
    vagas: [vaga("liquido", { grupos: ["laticinios"] })],
  })

  it("marca evitada não entra na opção de vaga", () => {
    const qualidades: Entrada["qualidades"] = {
      presentes: [],
      buscadas: ["quente", "estavel"],
      evitar_gunas: [],
      evitar_marcas: ["fermentado"],
      evitar: [],
      conflitos: [],
      linhas_base: [],
    }
    const [c] = montarCandidatos(entrada({ qualidades }), kbCom([], [refeicaoComLiquido]))
    expect(c?.opcoes?.liquido?.map((i) => i.alimento_id)).toEqual(["ghee", "leite"])
  })

  it("filtro da pessoa tira a opção de vaga", () => {
    const filtro: FiltroPessoa = { ...filtroVazio, nao_gosta: ["leite"] }
    const [c] = montarCandidatos(entrada({ filtro }), kbCom([], [refeicaoComLiquido]))
    expect(c?.opcoes?.liquido?.map((i) => i.alimento_id)).toEqual(["ghee", "iogurte-natural"])
  })
})

describe("cortarParaOContexto", () => {
  function candidato(tipo: TipoDeSugestao, id: string, opcoes?: Candidato["opcoes"]): Candidato {
    return {
      tipo,
      id,
      nome: id,
      itens: [],
      contribui: [],
      linha_base: `praticas:${id}`,
      adequacao: 1,
      nota: 1,
      gosta: false,
      ajudou: 0,
      novidade: false,
      no_fim: false,
      ...(opcoes ? { opcoes } : {}),
    }
  }

  it("corta por tipo e limita as opções de cada vaga", () => {
    const cha = ["c1", "c2", "c3", "c4", "c5"].map((id) => candidato("cha", id))
    const oleo = ["o1", "o2", "o3"].map((id) => candidato("oleo", id))
    const item = (alimento_id: string) => ({
      alimento_id,
      nome: alimento_id,
      casa: "ausente" as const,
      contribui: [],
      linha_base: `alimentos:${alimento_id}`,
    })
    const refeicao = candidato("refeicao", "r1", {
      gordura: [item("a"), item("b"), item("c"), item("d")],
    })
    const cortados = cortarParaOContexto([...cha, ...oleo, refeicao])

    expect(cortados.filter((c) => c.tipo === "cha").map((c) => c.id)).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
    ])
    expect(cortados.filter((c) => c.tipo === "oleo").map((c) => c.id)).toEqual(["o1", "o2"])
    expect(cortados.find((c) => c.id === "r1")?.opcoes?.gordura?.length).toBe(3)
  })
})
