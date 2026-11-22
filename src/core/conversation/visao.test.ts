import { describe, expect, it } from "vitest"
import type { Retorno } from "@/core/outcomes/ports"
import type { Proposta } from "@/core/proposals/ports"
import type { Run, RunEtapa } from "@/core/runs/ports"
import { visaoDoRun } from "./visao"

const agora = new Date("2026-06-15T22:00:00.000Z")
const ha = (minutos: number) => new Date(agora.getTime() - minutos * 60_000).toISOString()

function run(over: Partial<Run> = {}): Run {
  return {
    id: "r1",
    conta_id: "c1",
    caminho: "acompanhante",
    intencoes: [],
    status: "done",
    checkpoint: null,
    pendencia: null,
    momento: null,
    com_incomodo: false,
    clima_usado: null,
    saida: null,
    passos: 0,
    tokens_entrada: 0,
    tokens_saida: 0,
    latencia_ms: 0,
    modelos: {},
    trocas_de_modelo: 0,
    prompt_versao: null,
    juiz_tentativas: 0,
    juiz_aprovado: null,
    trace_id: null,
    dia: "2026-06-15",
    fora_da_conversa: false,
    criado_em: ha(5),
    atualizado_em: ha(5),
    ...over,
  }
}

function item(over: Record<string, unknown> = {}) {
  return {
    alimento_id: "gengibre",
    nome: "Gengibre",
    contribui: ["quente"],
    verbos: ["aquece"],
    linha_base: "gengibre:linha",
    casa: "confirmado",
    ...over,
  }
}

function sugestao(over: Record<string, unknown> = {}) {
  return {
    tipo: "cha",
    pratica_id: "cha-gengibre",
    titulo: "Chá de gengibre",
    como_fazer: "Ferva a água e junte o gengibre.",
    itens: [item()],
    verbos: ["aquece"],
    motivo: "Está frio",
    linhas_base: ["cha:linha"],
    novidade: false,
    ...over,
  }
}

function saida(over: Record<string, unknown> = {}) {
  return {
    origem: "agente",
    resposta: "Um chá quente ajuda agora.",
    geral: false,
    avisos: [],
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    anotacoes: [],
    propostas: [],
    ...over,
  }
}

const pergunta = {
  tipo: "come",
  texto: "Você come gengibre?",
  alimento_id: "gengibre",
  nome: "Gengibre",
}

function pendenciaPergunta(criada_em = ha(5)) {
  return {
    tipo: "pergunta",
    conteudo: { origem: "agente", pergunta },
    criada_em,
  }
}

function pendenciaAprovacao(criada_em = ha(5)) {
  return { tipo: "aprovacao", conteudo: { propostas: ["p1", "p2"] }, criada_em }
}

function proposta(over: Partial<Proposta> = {}): Proposta {
  return {
    id: "p1",
    run_id: "r1",
    conta_id: "c1",
    tool: "casa.propor",
    conteudo: {},
    decisao: "pendente",
    criado_em: ha(5),
    decidida_em: null,
    ...over,
  }
}

function retorno(over: Partial<Retorno> = {}): Retorno {
  return {
    id: "ret1",
    conta_id: "c1",
    run_id: "r1",
    sugestao: { tipo: "cha", alimentos: ["gengibre"], titulo: "Chá de gengibre" },
    status: "aguardando",
    resultado: null,
    origem: null,
    criado_em: ha(5),
    respondido_em: null,
    ...over,
  }
}

function etapa(over: Partial<RunEtapa> = {}): RunEtapa {
  return {
    run_id: "r1",
    ordem: 1,
    tipo: "interprete",
    nome: "interprete",
    resumo: null,
    status: "ok",
    duracao_ms: 0,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
    criado_em: ha(5),
    ...over,
  }
}

const base = { etapas: [], propostas: [], retornos: [], agora }

describe("visaoDoRun: campos básicos", () => {
  it("leva id, status, caminho, resposta, geral, avisos e evitar da saída", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          geral: true,
          avisos: [{ tipo: "geral", texto: "Aviso" }],
          evitar: [{ texto: "Evite fritura", linha_base: "x" }],
        }),
      }),
    })
    expect(v).toMatchObject({
      run_id: "r1",
      status: "done",
      caminho: "acompanhante",
      resposta: "Um chá quente ajuda agora.",
      geral: true,
      avisos: [{ tipo: "geral", texto: "Aviso" }],
      evitar: ["Evite fritura"],
      sugestoes: [],
      podeVotar: true,
    })
  })

  it("sem voto, o campo voto não aparece", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: saida() }) })
    expect(v).not.toHaveProperty("voto")
  })

  it("leva o voto quando há", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: saida() }), voto: "down" })
    expect(v.voto).toBe("down")
  })

  it("podeVotar é falso sem resposta", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: saida({ resposta: "" }) }) })
    expect(v.podeVotar).toBe(false)
  })

  it("para_ter sai com nome, vezes, verbos e motivo", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          para_ter: {
            alimento_id: "lentilha",
            nome: "Lentilha",
            vezes: 3,
            contribui: ["pesado"],
            linha_base: "lentilha:linha",
            verbos: ["assenta"],
            motivo: "Vale ter em casa",
          },
        }),
      }),
    })
    expect(v.para_ter).toEqual({
      nome: "Lentilha",
      vezes: 3,
      verbos: ["assenta"],
      motivo: "Vale ter em casa",
    })
  })
})

describe("visaoDoRun: frases das etapas", () => {
  it("usa frasesDoRun sobre as etapas do run", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida() }),
      etapas: [etapa({ tipo: "interprete" }), etapa({ tipo: "tool", nome: "clima.ler" })],
    })
    expect(v.frases.map((f) => f.chave)).toEqual(["entendendo", "clima"])
  })

  it("etapa com tipo desconhecido não quebra a visão", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida() }),
      etapas: [etapa({ tipo: "tipo_que_nao_existe" }), etapa({ tipo: "juiz", nome: "juiz" })],
    })
    expect(v.frases.map((f) => f.chave)).toEqual(["revisando"])
  })
})

describe("visaoDoRun: pergunta", () => {
  it("waiting_for_input dentro da espera é aberta", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        status: "waiting_for_input",
        pendencia: pendenciaPergunta(ha(5)),
      }),
    })
    expect(v.pergunta).toEqual({ estado: "aberta", pergunta })
  })

  it("waiting_for_input vencida na espera é expirou", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "waiting_for_input", pendencia: pendenciaPergunta(ha(31)) }),
    })
    expect(v.pergunta?.estado).toBe("expirou")
  })

  it("run expired com pergunta é expirou", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "expired", pendencia: pendenciaPergunta() }),
    })
    expect(v.pergunta?.estado).toBe("expirou")
  })

  it("run cancelled com pergunta é seguiu", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "cancelled", pendencia: pendenciaPergunta() }),
    })
    expect(v.pergunta?.estado).toBe("seguiu")
  })

  it("run que passou de waiting_for_input é respondida", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "done", pendencia: pendenciaPergunta() }),
    })
    expect(v.pergunta?.estado).toBe("respondida")
  })

  it("sem pendência de pergunta, não há pergunta", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: saida() }) })
    expect(v).not.toHaveProperty("pergunta")
  })

  it("pendência de aprovação não vira pergunta", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "waiting_for_approval", pendencia: pendenciaAprovacao() }),
    })
    expect(v).not.toHaveProperty("pergunta")
  })
})

describe("visaoDoRun: bloco de propostas", () => {
  const saidaComDuasLinhas = saida({
    propostas: [
      { id: "p1", tool: "casa.propor", texto: "Anotar abóbora" },
      { id: "p2", tool: "memoria.propor", texto: "Anotar rotina" },
    ],
  })

  function comDecisoes(d1: Proposta["decisao"], d2: Proposta["decisao"]) {
    return [proposta({ id: "p1", decisao: d1 }), proposta({ id: "p2", decisao: d2 })]
  }

  it("sem propostas na saída, não há bloco", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: saida() }) })
    expect(v).not.toHaveProperty("bloco")
  })

  it("waiting_for_approval dentro da espera é aberto, com as linhas pendentes", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        status: "waiting_for_approval",
        pendencia: pendenciaAprovacao(ha(5)),
        saida: saidaComDuasLinhas,
      }),
      propostas: comDecisoes("pendente", "pendente"),
    })
    expect(v.bloco).toEqual({
      estado: "aberto",
      linhas: [
        { id: "p1", texto: "Anotar abóbora", decisao: "pendente" },
        { id: "p2", texto: "Anotar rotina", decisao: "pendente" },
      ],
    })
  })

  it("waiting_for_approval vencido na espera é expirou", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        status: "waiting_for_approval",
        pendencia: pendenciaAprovacao(ha(31)),
        saida: saidaComDuasLinhas,
      }),
      propostas: comDecisoes("pendente", "pendente"),
    })
    expect(v.bloco?.estado).toBe("expirou")
  })

  it("expired é expirou", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "expired", saida: saidaComDuasLinhas }),
      propostas: comDecisoes("expirada", "expirada"),
    })
    expect(v.bloco?.estado).toBe("expirou")
  })

  it("done com alguma aprovada é anotado", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "done", saida: saidaComDuasLinhas }),
      propostas: comDecisoes("aprovada", "recusada"),
    })
    expect(v.bloco?.estado).toBe("anotado")
    expect(v.bloco?.linhas.map((l) => l.decisao)).toEqual(["aprovada", "recusada"])
  })

  it("done com todas recusadas é recusado", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "done", saida: saidaComDuasLinhas }),
      propostas: comDecisoes("recusada", "recusada"),
    })
    expect(v.bloco?.estado).toBe("recusado")
  })

  it("done com propostas expiradas (nova mensagem) é seguiu", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "done", saida: saidaComDuasLinhas }),
      propostas: comDecisoes("expirada", "expirada"),
    })
    expect(v.bloco?.estado).toBe("seguiu")
  })

  it("linha sem proposta no banco fica como pendente", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ status: "done", saida: saidaComDuasLinhas }),
      propostas: [proposta({ id: "p1", decisao: "aprovada" })],
    })
    expect(v.bloco?.linhas[1]?.decisao).toBe("pendente")
  })
})

describe("visaoDoRun: sugestões e itens", () => {
  it("sugestão leva posição, tipo, textos, verbos, motivo, novidade e aviso", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          sugestoes: [sugestao({ novidade: true, aviso: "Cuidado com o sal" })],
        }),
      }),
    })
    expect(v.sugestoes).toEqual([
      {
        posicao: 0,
        tipo: "cha",
        titulo: "Chá de gengibre",
        como_fazer: "Ferva a água e junte o gengibre.",
        itens: [
          {
            alimento_id: "gengibre",
            nome: "Gengibre",
            verbos: ["aquece"],
            incerto: false,
          },
        ],
        verbos: ["aquece"],
        motivo: "Está frio",
        novidade: true,
        aviso: "Cuidado com o sal",
        podeTrocar: false,
      },
    ])
  })

  it("posição segue a ordem de sugestoes", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          sugestoes: [sugestao({ titulo: "A" }), sugestao({ titulo: "B" })],
        }),
      }),
    })
    expect(v.sugestoes.map((s) => [s.posicao, s.titulo])).toEqual([
      [0, "A"],
      [1, "B"],
    ])
  })

  it("item incerto sem troca é marcado como incerto", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          sugestoes: [sugestao({ itens: [item({ casa: "incerto" })] })],
        }),
      }),
    })
    expect(v.sugestoes[0]?.itens[0]?.incerto).toBe(true)
  })

  it("item incerto com troca não é incerto, e a troca aparece com id, nome e frase", () => {
    const troca = {
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      contribui: ["quente"],
      verbos: ["aquece", "perfuma"],
      linha_base: "cardamomo:linha",
      frase: "Sem gengibre, use cardamomo.",
      anteriores: [],
    }
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          sugestoes: [sugestao({ itens: [item({ casa: "incerto", troca })] })],
        }),
      }),
    })
    expect(v.sugestoes[0]?.itens[0]).toEqual({
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      verbos: ["aquece", "perfuma"],
      incerto: false,
      troca: { frase: "Sem gengibre, use cardamomo." },
    })
  })

  it("item sem casa confirmada nem incerta é ausente e não incerto", () => {
    const v = visaoDoRun({
      ...base,
      run: run({
        saida: saida({
          sugestoes: [sugestao({ itens: [item({ casa: "ausente" })] })],
        }),
      }),
    })
    expect(v.sugestoes[0]?.itens[0]?.incerto).toBe(false)
  })

  it("podeTrocar é falso sem retorno_id", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida({ sugestoes: [sugestao()] }) }),
      retornos: [retorno()],
    })
    expect(v.sugestoes[0]?.podeTrocar).toBe(false)
  })

  it("podeTrocar é verdadeiro com retorno aguardando", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida({ sugestoes: [sugestao({ retorno_id: "ret1" })] }) }),
      retornos: [retorno({ id: "ret1", status: "aguardando" })],
    })
    expect(v.sugestoes[0]?.podeTrocar).toBe(true)
  })

  it("podeTrocar é falso com retorno já respondido", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida({ sugestoes: [sugestao({ retorno_id: "ret1" })] }) }),
      retornos: [retorno({ id: "ret1", status: "respondido", resultado: "ajudou" })],
    })
    expect(v.sugestoes[0]?.podeTrocar).toBe(false)
  })

  it("podeTrocar é falso se o retorno não está entre os retornos do run", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: saida({ sugestoes: [sugestao({ retorno_id: "ret9" })] }) }),
      retornos: [retorno({ id: "ret1" })],
    })
    expect(v.sugestoes[0]?.podeTrocar).toBe(false)
  })
})

describe("visaoDoRun: saída inválida", () => {
  it("saída que não passa no schema vira visão só com a resposta e as frases", () => {
    const v = visaoDoRun({
      ...base,
      run: run({ saida: { resposta: "Texto de antes." } }),
      etapas: [etapa({ tipo: "interprete" })],
    })
    expect(v).toMatchObject({
      resposta: "Texto de antes.",
      frases: [{ chave: "entendendo", texto: expect.any(String) }],
      sugestoes: [],
      avisos: [],
      evitar: [],
      podeVotar: true,
    })
    expect(v).not.toHaveProperty("bloco")
    expect(v).not.toHaveProperty("para_ter")
  })

  it("saída nula não lança e fica sem resposta", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: null }) })
    expect(v.resposta).toBeUndefined()
    expect(v.podeVotar).toBe(false)
    expect(v.sugestoes).toEqual([])
  })

  it("saída com texto vazio não traz resposta", () => {
    const v = visaoDoRun({ ...base, run: run({ saida: { resposta: "" } }) })
    expect(v.resposta).toBeUndefined()
  })
})

describe("visaoDoRun: o que não vai para a tela", () => {
  it("um cenário completo não leva campos internos", () => {
    const linhaBase = "gengibre:linha"
    const v = visaoDoRun({
      run: run({
        status: "waiting_for_approval",
        pendencia: pendenciaAprovacao(ha(5)),
        checkpoint: { versao: 1, mensagens: [], tokens: { entrada: 9, saida: 9 } },
        clima_usado: { cidade: "Recife", faixa: "quente" },
        modelos: { principal: "modelo-secreto" },
        tokens_entrada: 111,
        saida: saida({
          sugestoes: [sugestao({ retorno_id: "ret1" })],
          citados: ["gengibre"],
          propostas: [{ id: "p1", tool: "casa.propor", texto: "Anotar" }],
        }),
      }),
      etapas: [etapa({ tipo: "llm", nome: "acompanhante", modelo: "modelo-secreto" })],
      propostas: [proposta({ id: "p1" })],
      retornos: [retorno()],
      voto: "up",
      agora,
    })
    const json = JSON.stringify(v)
    for (const proibido of [
      "linha_base",
      "linhas_base",
      "citados",
      "checkpoint",
      "tokens",
      "modelo",
      "clima_usado",
      "Recife",
      "pendencia",
      "criada_em",
      linhaBase,
    ]) {
      expect(json).not.toContain(proibido)
    }
  })
})
