import { describe, expect, it } from "vitest"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Pratica } from "@/core/knowledge/schemas"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { DadosDoPreparo } from "./preparo"
import type { EntregaDoModelo } from "./saida"
import { type CodigoDeViolacao, validarEntrega } from "./validador"

const kb = createMiniKnowledge()
const CONFIRMADOS = ["gengibre", "canela", "cardamomo", "leite", "mel", "arroz-branco", "ghee"]
const sinais: SinaisPessoa = { em_casa: CONFIRMADOS, gosta: [], ajudou: {} }

function candidato(id: string, novidade = false): DadosDoPreparo["candidatos"][number] {
  return {
    tipo: "cha",
    id,
    nome: id,
    itens: [],
    contribui: ["quente"],
    linha_base: `praticas:${id}`,
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade,
    no_fim: false,
  }
}

function dados(mudar: Partial<DadosDoPreparo> = {}): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "tarde",
    geral: false,
    qualidades: {
      presentes: ["frio"],
      buscadas: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar: [{ texto: "gelados e crus", linha_base: "estados:com_frio" }],
      conflitos: [],
      linhas_base: ["estados:com_frio"],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: CONFIRMADOS, incertos: ["limao"] },
    candidatos: [candidato("cha-gengibre")],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 7,
      itens_incertos_em_casa: 1,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
    ...mudar,
  }
}

const cha: EntregaDoModelo["sugestoes"][number] = {
  tipo: "cha",
  pratica_id: "cha-gengibre",
  itens: [{ alimento_id: "gengibre", contribui: ["quente"], linha_base: "alimentos:gengibre" }],
  motivo: "Aquece o corpo.",
  linhas_base: ["praticas:cha-gengibre", "alimentos:gengibre"],
  novidade: false,
}

const refeicao: EntregaDoModelo["sugestoes"][number] = {
  tipo: "refeicao",
  preparo_id: "leite-morno-com-especiaria",
  itens: [
    {
      alimento_id: "leite",
      funcao: "liquido",
      contribui: [],
      linha_base: "alimentos:leite",
    },
    {
      alimento_id: "canela",
      funcao: "tempero",
      contribui: ["quente"],
      linha_base: "alimentos:canela",
    },
  ],
  motivo: "Nutre e aquece à noite.",
  linhas_base: ["preparos:leite-morno-com-especiaria", "alimentos:leite", "alimentos:canela"],
  novidade: false,
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [cha],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

function codigos(
  e: EntregaDoModelo,
  d: DadosDoPreparo = dados(),
  extra: { clima?: { gunas: ("quente" | "frio")[] }; kb?: KnowledgeBase } = {},
): CodigoDeViolacao[] {
  const violacoes = validarEntrega(e, {
    dados: d,
    kb: extra.kb ?? kb,
    sinais,
    ...(extra.clima ? { clima: extra.clima } : {}),
  })
  return [...new Set(violacoes.map((v) => v.codigo))]
}

const comItem = (mudar: Partial<(typeof cha.itens)[number]>) =>
  entrega({ sugestoes: [{ ...cha, itens: [{ ...(cha.itens[0] as object), ...mudar }] }] } as never)

const comSugestao = (mudar: Partial<typeof cha>) => entrega({ sugestoes: [{ ...cha, ...mudar }] })

describe("validarEntrega", () => {
  it("entrega correta não aponta nada", () => {
    expect(validarEntrega(entrega(), { dados: dados(), kb, sinais })).toEqual([])
    expect(
      validarEntrega(entrega({ sugestoes: [refeicao] }), { dados: dados(), kb, sinais }),
    ).toEqual([])
  })

  describe("fora_da_base", () => {
    it.each([
      ["sem nenhum id", comSugestao({ pratica_id: undefined })],
      ["tipo que não bate", comSugestao({ tipo: "oleo" })],
      ["se_faltar inexistente", comItem({ se_faltar: "nao-existe" })],
      ["citado inexistente", entrega({ citados: ["alimentos:nao-existe"] })],
    ])("%s", (_nome, e) => {
      expect(codigos(e)).toEqual(["fora_da_base"])
    })

    it("preparo_id inexistente (a linha dele também não existe)", () => {
      const e = entrega({
        sugestoes: [{ ...refeicao, preparo_id: "nao-existe", linhas_base: ["alimentos:leite"] }],
      })
      expect(codigos(e)).toEqual(["linha_base", "fora_da_base"])
    })

    it("pratica_id e preparo_id juntos", () => {
      expect(codigos(comSugestao({ preparo_id: "mingau" }))).toEqual(["fora_da_base"])
    })

    it("alimento_id inexistente", () => {
      expect(codigos(comItem({ alimento_id: "nao-existe" }))).toEqual(["estrutura", "fora_da_base"])
    })
  })

  describe("estrutura", () => {
    it("itens diferentes dos ingredientes da prática", () => {
      expect(codigos(comSugestao({ itens: [] }))).toEqual(["estrutura"])
    })

    it("a mensagem da prática sem ingredientes manda deixar itens vazio", () => {
      const e = comSugestao({
        tipo: "pratica",
        pratica_id: "respiracao-lenta",
        itens: [{ alimento_id: "respiracao-lenta", contribui: [], linha_base: "x" }],
      } as never)
      const v = validarEntrega(e, { dados: dados(), kb, sinais }).filter(
        (x) => x.codigo === "estrutura",
      )
      expect(v[0]?.mensagem).toContain("deixe itens vazio")
    })

    it("a mensagem da prática com ingredientes lista os ids esperados", () => {
      const v = validarEntrega(comSugestao({ itens: [] }), { dados: dados(), kb, sinais })
      expect(v.find((x) => x.codigo === "estrutura")?.mensagem).toContain("gengibre")
    })

    it("vaga obrigatória sem item", () => {
      const e = entrega({ sugestoes: [{ ...refeicao, itens: [refeicao.itens[0] as never] }] })
      expect(codigos(e)).toEqual(["estrutura"])
    })

    it("função que não é vaga do preparo", () => {
      const itens = [...refeicao.itens, { ...(refeicao.itens[1] as object), funcao: "fruta" }]
      expect(codigos(entrega({ sugestoes: [{ ...refeicao, itens }] } as never))).toEqual([
        "estrutura",
      ])
    })

    it("mais itens que o máximo da vaga", () => {
      const itens = [
        ...refeicao.itens,
        {
          ...(refeicao.itens[1] as object),
          alimento_id: "cardamomo",
          linha_base: "alimentos:cardamomo",
        },
      ]
      expect(codigos(entrega({ sugestoes: [{ ...refeicao, itens }] } as never))).toEqual([
        "estrutura",
      ])
    })
  })

  describe("fora_de_casa", () => {
    it("alimento ausente da casa", () => {
      const d = dados({ casa: { confirmados: ["canela"], incertos: [] } })
      expect(codigos(entrega(), d)).toEqual(["fora_de_casa"])
    })

    it("incerto sem se_faltar", () => {
      const d = dados({
        casa: { confirmados: CONFIRMADOS.filter((i) => i !== "gengibre"), incertos: ["gengibre"] },
      })
      expect(codigos(entrega(), d)).toEqual(["fora_de_casa"])
    })

    it("incerto com se_faltar válido passa", () => {
      const d = dados({
        casa: { confirmados: CONFIRMADOS.filter((i) => i !== "gengibre"), incertos: ["gengibre"] },
      })
      expect(codigos(comItem({ se_faltar: "cardamomo" }), d)).toEqual([])
    })

    it("se_faltar fora dos substitutos", () => {
      expect(codigos(comItem({ se_faltar: "mel" }))).toEqual(["fora_de_casa"])
    })

    it("se_faltar sem estar confirmado em casa", () => {
      const d = dados({ casa: { confirmados: ["gengibre"], incertos: [] } })
      expect(codigos(comItem({ se_faltar: "cardamomo" }), d)).toEqual(["fora_de_casa"])
    })
  })

  describe("filtro da pessoa", () => {
    const filtro = (m: Partial<DadosDoPreparo["filtro"]>) =>
      dados({ filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [], ...m } })

    it("evitar_sempre", () => {
      const d = filtro({ evitar: [{ tipo: "alimento", valor: "gengibre" }] })
      expect(codigos(entrega(), d)).toEqual(["evitar_sempre"])
    })

    it("restricao", () => {
      const d = filtro({ restricoes: ["vegana"] })
      expect(codigos(entrega({ sugestoes: [refeicao] }), d)).toEqual(["restricao"])
    })

    it("nao_come", () => {
      expect(codigos(entrega(), filtro({ nao_come: ["gengibre"] }))).toEqual(["nao_come"])
    })

    it("nao_gosta", () => {
      expect(codigos(entrega(), filtro({ nao_gosta: ["gengibre"] }))).toEqual(["nao_gosta"])
    })

    it("evitar_sempre no se_faltar", () => {
      const d = dados({
        casa: { confirmados: CONFIRMADOS.filter((i) => i !== "gengibre"), incertos: ["gengibre"] },
        filtro: {
          evitar: [{ tipo: "alimento", valor: "cardamomo" }],
          restricoes: [],
          nao_come: [],
          nao_gosta: [],
        },
      })
      expect(codigos(comItem({ se_faltar: "cardamomo" }), d)).toEqual(["evitar_sempre"])
    })

    it("se_faltar reprovado no filtro pula a checagem de substitutos", () => {
      const d = filtro({ nao_come: ["mel"] })
      expect(codigos(comItem({ se_faltar: "mel" }), d)).toEqual(["nao_come"])
    })

    it("evitar_sempre no para_ter", () => {
      const pt = {
        alimento_id: "mel",
        vezes: 3,
        contribui: ["pesado" as const],
        linha_base: "alimentos:mel",
      }
      const d = dados({
        para_ter: { ...pt, nome: "Mel" },
        filtro: {
          evitar: [{ tipo: "alimento", valor: "mel" }],
          restricoes: [],
          nao_come: [],
          nao_gosta: [],
        },
      })
      expect(codigos(entrega({ para_ter: pt }), d)).toEqual(["evitar_sempre"])
    })

    it("aponta também o citado", () => {
      expect(
        codigos(entrega({ citados: ["alimentos:mel"] }), filtro({ nao_come: ["mel"] })),
      ).toEqual(["nao_come"])
    })
  })

  describe("contraindicacao", () => {
    it("estado do momento", () => {
      expect(codigos(entrega(), dados({ estados: ["com_frio", "irritada"] }))).toEqual([
        "contraindicacao",
      ])
    })

    it("nunca_sugerir_se", () => {
      const gengibre = kb.pratica("cha-gengibre") as Pratica
      const outro: KnowledgeBase = {
        ...kb,
        pratica: (id) =>
          id === gengibre.id ? { ...gengibre, nunca_sugerir_se: ["vegana"] } : kb.pratica(id),
      }
      const vegana = dados({
        filtro: { evitar: [], restricoes: ["vegana"], nao_come: [], nao_gosta: [] },
      })
      expect(codigos(entrega(), vegana, { kb: outro })).toEqual(["contraindicacao"])
      expect(codigos(entrega(), dados(), { kb: outro })).toEqual([])
    })

    it("marca a evitar", () => {
      const d = dados({ qualidades: { ...dados().qualidades, evitar_marcas: ["fruta_azeda"] } })
      const e = entrega({
        sugestoes: [
          {
            ...cha,
            pratica_id: "cha-gengibre-limao-mel",
            itens: ["gengibre", "limao", "mel"].map((id) => ({
              alimento_id: id,
              contribui: [],
              linha_base: `alimentos:${id}`,
            })),
            linhas_base: ["praticas:cha-gengibre-limao-mel"],
          },
        ],
      })
      const d2 = { ...d, casa: { confirmados: ["gengibre", "limao", "mel"], incertos: [] } }
      expect(codigos(e, d2)).toEqual(["contraindicacao"])
    })
  })

  it("combinacao: conflito entre itens da sugestão", () => {
    const outro: KnowledgeBase = {
      ...kb,
      combinacoes: [
        ...kb.combinacoes,
        {
          id: "canela-cardamomo",
          itens: ["alimento:canela", "alimento:cardamomo"],
          motivo: "teste",
          fontes: [{ ref: "fonte-teste", campos: [] }],
          confianca: "alta",
        },
      ],
    }
    const e = entrega({
      sugestoes: [
        {
          ...cha,
          pratica_id: "cha-canela-cardamomo",
          itens: ["canela", "cardamomo"].map((id) => ({
            alimento_id: id,
            contribui: ["quente"],
            linha_base: `alimentos:${id}`,
          })),
          linhas_base: ["praticas:cha-canela-cardamomo"],
        },
      ],
    })
    expect(codigos(e, dados(), { kb: outro })).toEqual(["combinacao"])
    expect(codigos(e)).toEqual([])
  })

  describe("repetida", () => {
    it("já sugerida hoje", () => {
      expect(codigos(entrega(), dados({ sugeridos_hoje: ["praticas:cha-gengibre"] }))).toEqual([
        "repetida",
      ])
    })

    it("duas vezes na entrega", () => {
      expect(codigos(entrega({ sugestoes: [cha, cha] }))).toEqual(["repetida"])
    })
  })

  describe("linha_base", () => {
    it.each([
      ["linha do item errada", comItem({ linha_base: "alimentos:canela" })],
      ["linhas_base vazio", comSugestao({ linhas_base: [] })],
      [
        "linha inexistente",
        comSugestao({ linhas_base: ["praticas:cha-gengibre", "alimentos:xx"] }),
      ],
      ["sem a linha da própria sugestão", comSugestao({ linhas_base: ["alimentos:gengibre"] })],
      ["motivo vazio", comSugestao({ motivo: "" })],
      ["evitar fora das linhas do momento", entrega({ evitar: ["estados:com_calor"] })],
    ])("%s", (_nome, e) => {
      expect(codigos(e)).toEqual(["linha_base"])
    })
  })

  describe("qualidades", () => {
    it("qualidade do momento fora de presentes", () => {
      const e = entrega({
        explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["quente"] },
      })
      expect(codigos(e)).toEqual(["qualidades"])
    })

    it("aceita a qualidade do clima consultado", () => {
      const e = entrega({
        explicacao: { qualidades_do_momento: ["frio", "quente"], qualidades_buscadas: ["quente"] },
      })
      expect(codigos(e, dados(), { clima: { gunas: ["quente"] } })).toEqual([])
    })

    it("aceita buscada oposta ao clima", () => {
      const e = entrega({
        explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente", "frio"] },
      })
      expect(codigos(e)).toEqual(["qualidades"])
      expect(codigos(e, dados(), { clima: { gunas: ["quente"] } })).toEqual([])
      expect(codigos(e, dados(), { clima: { gunas: ["frio"] } })).toEqual(["qualidades"])
    })

    it("buscada fora de buscadas", () => {
      const e = entrega({
        explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["seco"] },
      })
      expect(codigos(e)).toEqual(["qualidades"])
    })

    it("contribui que o item tem mas não está em qualidades_buscadas", () => {
      expect(codigos(comItem({ contribui: ["movel"] }))).toEqual(["qualidades"])
    })

    it("contribui que o item não tem", () => {
      expect(codigos(comItem({ contribui: ["quente", "frio"] }))).toEqual(["qualidades"])
    })
  })

  it("novidade: marcada em quem não veio marcado", () => {
    expect(codigos(comSugestao({ novidade: true }))).toEqual(["novidade"])
    const d = dados({ candidatos: [candidato("cha-gengibre", true)] })
    expect(codigos(comSugestao({ novidade: true }), d)).toEqual([])
  })

  describe("para_ter", () => {
    const pt = {
      alimento_id: "mel",
      vezes: 3,
      contribui: ["pesado" as const],
      linha_base: "alimentos:mel",
    }
    const comParaTer = dados({
      para_ter: {
        alimento_id: "mel",
        nome: "Mel",
        vezes: 3,
        contribui: ["pesado"],
        linha_base: "alimentos:mel",
      },
    })

    it("sem para_ter no contexto", () => {
      expect(codigos(entrega({ para_ter: pt }))).toEqual(["para_ter"])
    })

    it("igual ao do contexto passa", () => {
      expect(codigos(entrega({ para_ter: pt }), comParaTer)).toEqual([])
    })

    it.each([
      ["vezes", { ...pt, vezes: 2 }],
      ["alimento", { ...pt, alimento_id: "ghee" }],
      ["linha", { ...pt, linha_base: "alimentos:ghee" }],
    ])("%s diferente", (_nome, valor) => {
      expect(codigos(entrega({ para_ter: valor }), comParaTer)).toEqual(["para_ter"])
    })
  })

  describe("texto_sem_estrutura", () => {
    it("alimento citado só no texto", () => {
      expect(codigos(entrega({ resposta: "Um chá com canela ajuda." }))).toEqual([
        "texto_sem_estrutura",
      ])
    })

    it("liberado por citados", () => {
      const e = entrega({ resposta: "Um chá com canela ajuda.", citados: ["alimentos:canela"] })
      expect(codigos(e)).toEqual([])
    })

    it("nome de prática no texto", () => {
      const e = entrega({ resposta: "Que tal uma respiração lenta agora?" })
      expect(codigos(e)).toEqual(["texto_sem_estrutura"])
    })

    it("palavra inteira e ignora café da manhã", () => {
      const cafe = {
        ...(kb.alimento("gengibre") as object),
        id: "cafe",
        nome: "Café",
        sinonimos: [],
      }
      const outro = { ...kb, alimentos: [...kb.alimentos, cafe] } as unknown as KnowledgeBase
      const ok = entrega({ resposta: "Tome seu café da manhã com calma." })
      expect(codigos(ok, dados(), { kb: outro })).toEqual([])
      const ruim = entrega({ resposta: "Tome um café agora." })
      expect(codigos(ruim, dados(), { kb: outro })).toEqual(["texto_sem_estrutura"])
    })
  })

  describe("tamanho", () => {
    it.each([
      ["resposta vazia", entrega({ resposta: "" })],
      ["resposta longa", entrega({ resposta: "a".repeat(901) })],
      ["motivo longo", comSugestao({ motivo: "a".repeat(201) })],
      ["incertos demais", entrega({ incertos: ["a", "b", "c", "d"] })],
      ["incerto longo", entrega({ incertos: ["a".repeat(121)] })],
      ["citados demais", entrega({ citados: Array(6).fill("alimentos:mel") })],
    ])("%s", (_nome, e) => {
      expect(codigos(e)).toEqual(["tamanho"])
    })

    it("sugestões demais", () => {
      const item = (id: string, contribui: ("quente" | "frio")[] = []) => ({
        alimento_id: id,
        contribui,
        linha_base: `alimentos:${id}`,
      })
      const outras = [
        {
          ...cha,
          pratica_id: "cha-canela-cardamomo",
          itens: [item("canela"), item("cardamomo")],
          linhas_base: ["praticas:cha-canela-cardamomo"],
        },
        {
          ...cha,
          tipo: "pratica" as const,
          pratica_id: "respiracao-lenta",
          itens: [],
          linhas_base: ["praticas:respiracao-lenta"],
        },
        {
          ...cha,
          tipo: "oleo" as const,
          pratica_id: "oleo-pes-gergelim",
          itens: [item("oleo-de-gergelim")],
          linhas_base: ["praticas:oleo-pes-gergelim"],
        },
      ]
      const d = dados({ casa: { confirmados: [...CONFIRMADOS, "oleo-de-gergelim"], incertos: [] } })
      expect(codigos(entrega({ sugestoes: [cha, ...outras] }), d)).toEqual(["tamanho"])
    })
  })

  describe("vazia", () => {
    it("momento com candidatos e entrega sem nada", () => {
      expect(codigos(entrega({ sugestoes: [] }))).toEqual(["vazia"])
    })

    it("um incerto basta", () => {
      expect(codigos(entrega({ sugestoes: [], incertos: ["Não sei sobre isso."] }))).toEqual([])
    })

    it("sem candidatos no contexto não aponta", () => {
      expect(codigos(entrega({ sugestoes: [] }), dados({ candidatos: [] }))).toEqual([])
    })
  })

  it("mensagens citam ids e a ordem segue o percurso", () => {
    const e = entrega({ sugestoes: [cha, refeicao], resposta: "" })
    const d = dados({ casa: { confirmados: ["canela"], incertos: [] } })
    const v = validarEntrega(e, { dados: d, kb, sinais })
    expect(v[0]?.onde).toBe("sugestoes[0].itens[0]")
    expect(v.at(-1)?.onde).toBe("resposta")
    expect(v[0]?.mensagem).toContain("gengibre")
  })
})

describe("mensagens que dizem o valor aceito", () => {
  const mensagens = (e: EntregaDoModelo) =>
    validarEntrega(e, { dados: dados(), kb, sinais }).map((v) => v.mensagem)

  it("evitar fora das linhas lista as linhas aceitas", () => {
    const m = mensagens(entrega({ evitar: ["gelados e crus"] }))
    expect(m.some((x) => x.includes("estados:com_frio"))).toBe(true)
  })

  it("citado sem tabela explica o formato tabela:id", () => {
    const m = mensagens(entrega({ citados: ["gengibre"] }))
    expect(m.some((x) => x.includes("alimentos:gengibre"))).toBe(true)
  })

  it("qualidade fora do momento lista as aceitas", () => {
    const m = mensagens(
      entrega({
        explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["quente"] },
      }),
    )
    expect(m.some((x) => x.includes("frio"))).toBe(true)
  })

  it("prática e preparo juntos ou ausentes dizem para usar só um", () => {
    const base = { ...cha, pratica_id: undefined }
    const m = mensagens(entrega({ sugestoes: [base] }))
    expect(m.some((x) => x.includes("pratica_id") && x.includes("preparo_id"))).toBe(true)
  })
})
