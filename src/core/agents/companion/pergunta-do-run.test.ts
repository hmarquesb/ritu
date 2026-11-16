import { describe, expect, it } from "vitest"
import type { Candidato, EstadoNaCasa, ItemDoCandidato } from "@/core/ranking/tipos"
import {
  montarPergunta,
  type Pergunta,
  perguntaDaVariante,
  type RespostaDaPessoa,
} from "@/core/runs/pergunta"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { aplicarResposta, candidatosRetirados, conteudoDaPendenciaSchema } from "./pergunta-do-run"
import type { DadosDoPreparo } from "./preparo"

const kb = createMiniKnowledge()

function item(alimento_id: string, casa: EstadoNaCasa): ItemDoCandidato {
  return {
    alimento_id,
    nome: alimento_id,
    casa,
    contribui: ["quente"],
    linha_base: `alimentos:${alimento_id}`,
  }
}

// Refeição com duas vagas obrigatórias: base (batata-doce, incerta) e gordura (ghee, confirmada).
function purê(): Candidato {
  const base = item("batata-doce", "incerto")
  const gordura = item("ghee", "confirmado")
  return {
    tipo: "refeicao",
    id: "pure-de-raiz",
    nome: "Purê de raiz",
    itens: [base, gordura],
    opcoes: { base: [base], gordura: [gordura] },
    contribui: ["quente"],
    linha_base: "preparos:pure-de-raiz",
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade: false,
    no_fim: false,
  }
}

function cha(): Candidato {
  return {
    tipo: "cha",
    id: "cha-gengibre",
    nome: "Chá de gengibre",
    itens: [item("gengibre", "confirmado")],
    contribui: ["quente"],
    linha_base: "praticas:cha-gengibre",
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade: false,
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
      evitar: [],
      conflitos: [],
      linhas_base: [],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: ["ghee", "gengibre"], incertos: ["batata-doce"] },
    candidatos: [purê(), cha()],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 2,
      itens_incertos_em_casa: 1,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
    perguntas: { feitas: 1, alimentos: [] },
    nao_come_do_run: [],
    candidatos_completos: [],
    acabou: [],
    nao_tem_do_run: [],
    candidatos_do_preparo: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
    retornos_pendentes: [],
    ...mudar,
  }
}

const perguntaDeBatata: Pergunta = montarPergunta(
  { tipo: "casa", alimentos: ["batata-doce"], incertos: ["batata-doce"] },
  kb,
)

function respostaDeCasa(
  id: string,
  resposta: "tenho" | "nao_tenho" | "nao_gosto",
): RespostaDaPessoa {
  return { tipo: "casa", itens: [{ alimento_id: id, resposta }] }
}

describe("aplicarResposta · casa", () => {
  it("Tenho tira o item de incertos, põe em confirmados e marca o casa dele como confirmado", () => {
    const out = aplicarResposta(
      dados(),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "tenho"),
      kb,
    )
    expect(out.casa.confirmados).toContain("batata-doce")
    expect(out.casa.incertos).not.toContain("batata-doce")
    const refeicao = out.candidatos.find((c) => c.id === "pure-de-raiz")
    expect(refeicao?.itens[0]?.casa).toBe("confirmado")
    expect(refeicao?.opcoes?.base?.[0]?.casa).toBe("confirmado")
  })

  it("Não tenho tira o item de incertos e marca o casa dele como ausente", () => {
    // Com outra opção confirmada na base, a refeição fica e o item perguntado aparece como ausente.
    const comDuasBases = {
      ...purê(),
      itens: [item("batata-doce", "incerto"), item("ghee", "confirmado")],
      opcoes: {
        base: [item("batata-doce", "incerto"), item("cenoura", "confirmado")],
        gordura: [item("ghee", "confirmado")],
      },
    }
    const out = aplicarResposta(
      dados({ candidatos: [comDuasBases], perguntas: { feitas: 1, alimentos: [] } }),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_tenho"),
      kb,
    )
    expect(out.casa.incertos).not.toContain("batata-doce")
    expect(out.casa.confirmados).not.toContain("batata-doce")
    const refeicao = out.candidatos.find((c) => c.id === "pure-de-raiz")
    expect(refeicao?.opcoes?.base?.[0]?.casa).toBe("ausente")
    expect(refeicao?.itens[0]?.casa).toBe("ausente")
  })

  it("Não tenho para a única opção de uma vaga obrigatória tira a refeição, e candidatosRetirados devolve o id", () => {
    const antes = dados()
    const out = aplicarResposta(
      antes,
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_tenho"),
      kb,
    )
    expect(out.candidatos.map((c) => c.id)).toEqual(["cha-gengibre"])
    expect(candidatosRetirados(antes, out)).toEqual(["pure-de-raiz"])
  })

  it("Não gosto entra em filtro.nao_gosta e sai das duas listas de casa", () => {
    const out = aplicarResposta(
      dados(),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_gosto"),
      kb,
    )
    expect(out.filtro.nao_gosta).toEqual(["batata-doce"])
    expect(out.casa.incertos).not.toContain("batata-doce")
    expect(out.casa.confirmados).not.toContain("batata-doce")
  })

  it("um alimento de acabou (Minha casa) não segura refeição depois de um Não tenho", () => {
    // Base com duas opções incertas: batata-doce está em acabou (Minha casa), cenoura é a perguntada.
    const refeicao: Candidato = {
      ...purê(),
      itens: [item("cenoura", "incerto"), item("ghee", "confirmado")],
      opcoes: {
        base: [item("cenoura", "incerto"), item("batata-doce", "ausente")],
        gordura: [item("ghee", "confirmado")],
      },
    }
    const entrada = dados({
      candidatos: [refeicao],
      casa: { confirmados: ["ghee"], incertos: ["cenoura"] },
      acabou: ["batata-doce"],
      perguntas: { feitas: 1, alimentos: [] },
    })
    const perguntaDeCenoura = montarPergunta(
      { tipo: "casa", alimentos: ["cenoura"], incertos: ["cenoura"] },
      kb,
    )
    const out = aplicarResposta(
      entrada,
      perguntaDeCenoura,
      respostaDeCasa("cenoura", "nao_tenho"),
      kb,
    )
    expect(out.candidatos.map((c) => c.id)).not.toContain("pure-de-raiz")
    expect(out.acabou).toEqual(["batata-doce", "cenoura"])
  })

  it("não repete ids nas listas quando a mesma resposta chega duas vezes", () => {
    const resposta = respostaDeCasa("batata-doce", "tenho")
    const uma = aplicarResposta(dados(), perguntaDeBatata, resposta, kb)
    const duas = aplicarResposta(uma, perguntaDeBatata, resposta, kb)
    expect(duas.casa.confirmados.filter((id) => id === "batata-doce")).toHaveLength(1)
    expect(duas.perguntas.alimentos.filter((id) => id === "batata-doce")).toHaveLength(1)
  })

  it("não muta os dados de entrada", () => {
    const entrada = dados()
    const copia = structuredClone(entrada)
    aplicarResposta(entrada, perguntaDeBatata, respostaDeCasa("batata-doce", "nao_tenho"), kb)
    expect(entrada).toEqual(copia)
  })
})

describe("aplicarResposta · come e demais respostas", () => {
  const perguntaDeMel: Pergunta = montarPergunta({ tipo: "come", alimento: "mel" }, kb)

  it("Não como entra em filtro.nao_come e em nao_come_do_run, sem repetir", () => {
    const resposta: RespostaDaPessoa = { tipo: "come", resposta: "nao_como" }
    const uma = aplicarResposta(dados(), perguntaDeMel, resposta, kb)
    const duas = aplicarResposta(uma, perguntaDeMel, resposta, kb)
    expect(duas.filtro.nao_come).toEqual(["mel"])
    expect(duas.nao_come_do_run).toEqual(["mel"])
  })

  it("Como não muda nada", () => {
    const entrada = dados()
    const out = aplicarResposta(entrada, perguntaDeMel, { tipo: "come", resposta: "como" }, kb)
    expect(out).toEqual(entrada)
  })

  it("Pular não muda nada, para casa, come e variante", () => {
    const entrada = dados()
    const variante = perguntaDaVariante({
      incomodo: "dor",
      pergunta: "Qual?",
      opcoes: [{ id: "a", texto: "A" }],
    })
    for (const pergunta of [perguntaDeBatata, perguntaDeMel, variante]) {
      expect(aplicarResposta(entrada, pergunta, { tipo: "pular" }, kb)).toEqual(entrada)
    }
  })

  it("variante não muda nada", () => {
    const entrada = dados()
    const variante = perguntaDaVariante({
      incomodo: "dor",
      pergunta: "Qual?",
      opcoes: [{ id: "a", texto: "A" }],
    })
    expect(aplicarResposta(entrada, variante, { tipo: "variante", variante: "a" }, kb)).toEqual(
      entrada,
    )
  })
})

describe("candidatosRetirados", () => {
  it("devolve os ids que estavam em antes e não estão em depois, na ordem", () => {
    const antes = dados({ candidatos: [purê(), cha(), { ...cha(), id: "oleo-de-coco" }] })
    const depois = dados({ candidatos: [cha()] })
    expect(candidatosRetirados(antes, depois)).toEqual(["pure-de-raiz", "oleo-de-coco"])
  })
})

describe("conteudoDaPendenciaSchema", () => {
  const pergunta = perguntaDeBatata
  const entrada = { intencoes: ["momento"], estados: [], evitar_da_mensagem: [] }

  it("aceita a origem agente, com anotações opcionais", () => {
    expect(conteudoDaPendenciaSchema.safeParse({ origem: "agente", pergunta }).success).toBe(true)
    expect(
      conteudoDaPendenciaSchema.safeParse({
        origem: "agente",
        pergunta,
        anotacoes: [{ tipo: "casa_tem", itens: [{ nome: "Canela" }] }],
      }).success,
    ).toBe(true)
  })

  it("aceita a origem codigo com a entrada do acompanhante", () => {
    expect(
      conteudoDaPendenciaSchema.safeParse({ origem: "codigo", pergunta, entrada }).success,
    ).toBe(true)
  })

  it("recusa origem desconhecida e codigo sem entrada", () => {
    expect(conteudoDaPendenciaSchema.safeParse({ origem: "outra", pergunta }).success).toBe(false)
    expect(conteudoDaPendenciaSchema.safeParse({ origem: "codigo", pergunta }).success).toBe(false)
  })
})

describe("aplicarResposta · nao_tem_do_run", () => {
  it("Não tenho põe o id em nao_tem_do_run, sem repetir em duas respostas", () => {
    const uma = aplicarResposta(
      dados(),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_tenho"),
      kb,
    )
    expect(uma.nao_tem_do_run).toEqual(["batata-doce"])
    const duas = aplicarResposta(
      uma,
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_tenho"),
      kb,
    )
    expect(duas.nao_tem_do_run).toEqual(["batata-doce"])
  })

  it("Tenho e Não gosto não entram em nao_tem_do_run", () => {
    const tenho = aplicarResposta(
      dados(),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "tenho"),
      kb,
    )
    const naoGosto = aplicarResposta(
      dados(),
      perguntaDeBatata,
      respostaDeCasa("batata-doce", "nao_gosto"),
      kb,
    )
    expect(tenho.nao_tem_do_run).toEqual([])
    expect(naoGosto.nao_tem_do_run).toEqual([])
  })
})
