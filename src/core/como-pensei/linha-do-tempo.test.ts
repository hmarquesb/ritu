import { describe, expect, it } from "vitest"
import type { Momento } from "@/core/memory-schemas"
import type { Proposta } from "@/core/proposals/ports"
import type { Run, RunEtapa } from "@/core/runs/ports"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { linhaDoTempo } from "./linha-do-tempo"

const kb = createMiniKnowledge()
const agora = new Date("2026-11-17T15:00:00Z")
const FUSO = "America/Sao_Paulo"

function run(over: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    conta_id: "conta-1",
    caminho: "acompanhante",
    intencoes: ["momento"],
    status: "done",
    checkpoint: null,
    pendencia: null,
    momento: null,
    com_incomodo: false,
    clima_usado: null,
    saida: null,
    passos: 6,
    tokens_entrada: 1200,
    tokens_saida: 340,
    latencia_ms: 4100,
    modelos: { principal: ["modelo-a"], juiz: ["modelo-b"] },
    trocas_de_modelo: 1,
    prompt_versao: "v6",
    juiz_tentativas: 1,
    juiz_aprovado: true,
    trace_id: null,
    dia: "2026-11-16",
    fora_da_conversa: false,
    criado_em: "2026-11-16T11:42:00Z",
    atualizado_em: "2026-11-16T11:43:00Z",
    ...over,
  }
}

let ordem = 0
function etapa(over: Partial<RunEtapa> & Pick<RunEtapa, "tipo" | "nome">): RunEtapa {
  ordem += 1
  return {
    run_id: "run-1",
    ordem,
    resumo: null,
    status: "ok",
    duracao_ms: 0,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
    criado_em: "2026-11-16T11:42:00Z",
    ...over,
  }
}

function proposta(over: Partial<Proposta> = {}): Proposta {
  return {
    id: "p-1",
    run_id: "run-1",
    conta_id: "conta-1",
    tool: "padrao.confirmar",
    conteudo: {
      tool: "padrao.confirmar",
      padrao_id: "x",
      frase: "Quando você está com frio, a sopa ajuda.",
    },
    decisao: "aprovada",
    criado_em: "2026-11-16T11:42:00Z",
    decidida_em: null,
    ...over,
  }
}

function montar(
  r: Run,
  etapas: RunEtapa[],
  propostas: Proposta[] = [],
  agoraDoTeste: Date = agora,
) {
  return linhaDoTempo({ run: r, etapas, propostas, kb, agora: agoraDoTeste, fuso: FUSO })
}

function passosDe(valor: ReturnType<typeof montar>) {
  if (valor.estado !== "pronto") throw new Error(`esperava pronto, veio ${valor.estado}`)
  return valor.passos
}

describe("linhaDoTempo · estados", () => {
  it("run aberto sem etapas é aberto", () => {
    expect(montar(run({ status: "running" }), []).estado).toBe("aberto")
  })

  it("run running com etapas continua aberto", () => {
    const e = [etapa({ tipo: "interprete", nome: "interprete", resumo: "momento" })]
    expect(montar(run({ status: "running" }), e).estado).toBe("aberto")
  })

  it("run esperando sem etapas é aberto", () => {
    expect(montar(run({ status: "waiting_for_input" }), []).estado).toBe("aberto")
    expect(montar(run({ status: "waiting_for_approval" }), []).estado).toBe("aberto")
  })

  it("run fechado sem etapas é sem_rastro", () => {
    expect(montar(run({ status: "done" }), []).estado).toBe("sem_rastro")
  })

  it("nunca lança com dados estranhos", () => {
    const r = run({ modelos: "lixo", saida: 42, clima_usado: [], momento: null })
    expect(() =>
      montar(r, [etapa({ tipo: "tool", nome: "clima.agora", resumo: "ok" })]),
    ).not.toThrow()
  })
})

describe("linhaDoTempo · cabeçalho e total", () => {
  it("quando: dia relativo e hora no fuso da pessoa", () => {
    const v = montar(run(), [etapa({ tipo: "tool", nome: "historico.recente", resumo: "1 dias" })])
    expect(v.estado === "pronto" && v.quando).toBe("Mensagem de ontem, 8:42")
  })

  it("quando: data curta para dias mais antigos", () => {
    const v = montar(run({ dia: "2026-11-12" }), [
      etapa({ tipo: "tool", nome: "historico.recente", resumo: "1 dias" }),
    ])
    expect(v.estado === "pronto" && v.quando).toBe("Mensagem de 12 nov., 8:42")
  })

  it("total vem do run e inclui o modelo das etapas llm", () => {
    const e = [
      etapa({
        tipo: "llm",
        nome: "modelo-a",
        modelo: "modelo-a",
        tokens_entrada: 900,
        tokens_saida: 200,
      }),
    ]
    const v = montar(run(), e)
    if (v.estado !== "pronto") throw new Error("esperava pronto")
    expect(v.total).toEqual({
      passos: 6,
      latencia_ms: 4100,
      tokens_entrada: 1200,
      tokens_saida: 340,
      modelos: [
        { papel: "principal", modelos: ["modelo-a"] },
        { papel: "juiz", modelos: ["modelo-b"] },
      ],
      trocas_de_modelo: 1,
      prompt_versao: "v6",
      juiz_tentativas: 1,
    })
    expect(v.passos.some((p) => p.tipo === "entendi")).toBe(false)
  })

  it("etapa llm não vira passo", () => {
    const v = passosDe(montar(run(), [etapa({ tipo: "llm", nome: "modelo-a" })]))
    expect(v.map((p) => p.tipo)).toEqual(["fim"])
  })
})

describe("linhaDoTempo · passos", () => {
  it("interprete: intenções em frase, estados do momento no detalhe", () => {
    const momento: Momento = { estados: ["com_frio"], momento_do_dia: "manha", gunas_buscadas: [] }
    const v = passosDe(
      montar(run({ momento }), [
        etapa({ tipo: "interprete", nome: "interprete", resumo: "momento,vida" }),
      ]),
    )
    expect(v[0]).toMatchObject({
      tipo: "entendi",
      frase: "Entendi que você falou de como você está agora e sua rotina.",
      detalhe: "Você estava com frio.",
    })
  })

  it("clima ok usa o clima do run", () => {
    const clima = { status: "ok", temperatura_aparente: 24, umidade: 60, gunas: ["quente"] }
    const v = passosDe(
      montar(run({ clima_usado: clima }), [
        etapa({ tipo: "tool", nome: "clima.agora", resumo: "ok" }),
      ]),
    )
    expect(v[0]).toMatchObject({
      tipo: "clima",
      frase: "Vi o clima: 24 °C, 60% de umidade.",
      detalhe: "Isso pede algo quente.",
    })
  })

  it("clima com mais de uma guna junta os nomes com vírgula e e", () => {
    const clima = {
      status: "ok",
      temperatura_aparente: 24,
      umidade: 60,
      gunas: ["leve", "seco", "estavel"],
    }
    const v = passosDe(
      montar(run({ clima_usado: clima }), [
        etapa({ tipo: "tool", nome: "clima.agora", resumo: "ok" }),
      ]),
    )
    expect(v[0]?.detalhe).toBe("Isso pede algo leve, seco e estável.")
  })

  it("clima sem cidade e indisponível", () => {
    const sem = passosDe(
      montar(run(), [etapa({ tipo: "tool", nome: "clima.agora", resumo: "sem cidade" })]),
    )
    expect(sem[0]?.frase).toBe("Sem cidade escolhida, respondi sem o clima.")
    const fora = passosDe(
      montar(run(), [etapa({ tipo: "tool", nome: "clima.agora", resumo: "indisponível" })]),
    )
    expect(fora[0]?.frase).toBe("O clima não respondeu; segui sem ele.")
  })

  it("clima próximas horas", () => {
    const v = passosDe(montar(run(), [etapa({ tipo: "tool", nome: "clima.proximas_horas" })]))
    expect(v[0]).toMatchObject({ tipo: "clima", frase: "Olhei o clima das próximas horas." })
  })

  it("casa, preferências, histórico e base", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "tool", nome: "casa.ler", resumo: "3 confirmados, 1 incertos" }),
        etapa({ tipo: "tool", nome: "preferencias.ler", resumo: "2 registros" }),
        etapa({ tipo: "tool", nome: "historico.recente", resumo: "2 dias" }),
        etapa({ tipo: "tool", nome: "ayurveda.candidatos", resumo: "4 candidatos" }),
      ]),
    )
    expect(v.map((p) => [p.tipo, p.frase])).toEqual([
      ["casa", "Olhei sua casa: 3 confirmados, 1 incertos."],
      ["lembrei", "Lembrei do que você gosta e do que funcionou."],
      ["lembrei", "Lembrei das últimas conversas: 2 dias."],
      ["base", "Consultei a base ayurvédica: 4 candidatos."],
      ["fim", "Entreguei a resposta."],
    ])
  })

  it("validação ok sem recusa antes", () => {
    const v = passosDe(
      montar(run(), [etapa({ tipo: "validacao", nome: "finalizar", resumo: "ok" })]),
    )
    expect(v[0]).toMatchObject({ tipo: "conferi", frase: "Conferi a resposta: tudo certo." })
    expect(v[0]?.marca).toBeUndefined()
  })

  it("validação recusada e depois aprovada", () => {
    const v = passosDe(
      montar(run(), [
        etapa({
          tipo: "validacao",
          nome: "finalizar",
          status: "recusado",
          resumo: "fora_de_casa,evitar_sempre",
        }),
        etapa({ tipo: "validacao", nome: "finalizar", resumo: "ok" }),
      ]),
    )
    expect(v[0]).toMatchObject({
      tipo: "conferi",
      frase: "Conferi a resposta e achei 2 problema(s).",
      detalhe: "um ingrediente que você não tem; algo que você evita sempre",
      marca: "corrigido",
    })
    expect(v[1]).toMatchObject({ tipo: "conferi", frase: "Corrigi e conferi de novo: tudo certo." })
  })

  it("validação com um problema, código desconhecido e último código partido ignorados", () => {
    const v = passosDe(
      montar(run(), [
        etapa({
          tipo: "validacao",
          nome: "finalizar",
          status: "recusado",
          resumo: "tamanho,codigo_novo,evitar_sem",
        }),
      ]),
    )
    expect(v[0]).toMatchObject({
      frase: "Conferi a resposta e achei 1 problema.",
      detalhe: "a resposta longa demais",
      marca: "corrigido",
    })
  })

  it("pergunta: casa, come e variante", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "pergunta", nome: "ask_user", resumo: "casa: 3 itens" }),
        etapa({ tipo: "pergunta", nome: "ask_user", resumo: "come" }),
        etapa({ tipo: "pergunta", nome: "ask_user", resumo: "variante" }),
      ]),
    )
    expect(v.slice(0, 3).map((p) => p.frase)).toEqual([
      "Perguntei se você tinha 3 itens.",
      "Perguntei se você come um alimento.",
      "Perguntei como era o incômodo.",
    ])
  })

  it("proposta: texto da linha, decisão no detalhe", () => {
    const v = passosDe(
      montar(run(), [etapa({ tipo: "proposta", nome: "padrao.confirmar" })], [proposta()]),
    )
    expect(v[0]).toMatchObject({
      tipo: "propus",
      frase: "Propus anotar: Notei isto. Está certo? Quando você está com frio, a sopa ajuda.",
      detalhe: "Você aprovou.",
    })
  })

  it("proposta recusada e expirada", () => {
    const recusada = passosDe(
      montar(
        run(),
        [etapa({ tipo: "proposta", nome: "padrao.confirmar" })],
        [proposta({ decisao: "recusada" })],
      ),
    )
    expect(recusada[0]?.detalhe).toBe("Você não aprovou.")
    const expirada = passosDe(
      montar(
        run(),
        [etapa({ tipo: "proposta", nome: "padrao.confirmar" })],
        [proposta({ decisao: "expirada" })],
      ),
    )
    expect(expirada[0]?.detalhe).toBe("A proposta expirou.")
  })

  it("aprovação e memória", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "aprovacao", nome: "aprovacao", resumo: "a anotação" }),
        etapa({ tipo: "memoria", nome: "resumo_de_rotina" }),
      ]),
    )
    expect(v.slice(0, 2).map((p) => p.frase)).toEqual([
      "Você aprovou a anotação.",
      "Atualizei o resumo da sua rotina.",
    ])
  })

  it("juiz aprovado, aprovado com nota, reprovado e indisponível", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "juiz", nome: "juiz", resumo: "aprovado" }),
        etapa({ tipo: "juiz", nome: "juiz", resumo: "aprovado; registros: tom" }),
        etapa({
          tipo: "juiz",
          nome: "juiz",
          status: "recusado",
          resumo: "reprovado: promessa, dosagem; registros: tom",
        }),
        etapa({ tipo: "juiz", nome: "juiz", status: "falhou", resumo: "indisponivel" }),
      ]),
    )
    expect(v.slice(0, 4).map((p) => [p.frase, p.detalhe, p.marca])).toEqual([
      ["Revisei a resposta com cuidado: aprovada.", undefined, undefined],
      [
        "Revisei a resposta com cuidado: aprovada, com uma nota de linguagem.",
        undefined,
        undefined,
      ],
      ["Revisei a resposta e pedi outra versão.", "uma promessa de cura; uma dose", "corrigido"],
      ["A revisão não respondeu; entreguei uma resposta segura.", undefined, "falhou"],
    ])
  })

  it("troca de modelo por cota e por 429", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "troca_de_modelo", nome: "modelo-b", resumo: "cota" }),
        etapa({ tipo: "troca_de_modelo", nome: "modelo-b", resumo: "429" }),
      ]),
    )
    expect(v.slice(0, 2).map((p) => [p.tipo, p.frase])).toEqual([
      ["troca", "Troquei de modelo: a cota do anterior acabou."],
      ["troca", "Troquei de modelo: o anterior não respondeu."],
    ])
  })

  it("erro e etapa falhada não listada viram passo marcado", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "erro", nome: "timeout", status: "falhou" }),
        etapa({ tipo: "tool", nome: "ayurveda.alimento", status: "falhou", resumo: "1 alimentos" }),
      ]),
    )
    expect(v[0]).toMatchObject({
      tipo: "erro",
      frase: "Tive um problema neste passo.",
      marca: "falhou",
    })
    expect(v[1]).toMatchObject({
      tipo: "base",
      frase: "Consultei a base ayurvédica: 1 alimentos.",
      marca: "falhou",
    })
  })

  it("etapas de controle ok não viram passo", () => {
    const v = passosDe(
      montar(run(), [etapa({ tipo: "tool", nome: "memoria.propor", resumo: "proposto" })]),
    )
    expect(v.map((p) => p.tipo)).toEqual(["fim"])
  })

  it("detalhe técnico vem da própria etapa", () => {
    const v = passosDe(
      montar(run(), [
        etapa({ tipo: "tool", nome: "clima.proximas_horas", modelo: null, duracao_ms: 120 }),
      ]),
    )
    expect(v[0]?.tecnico).toEqual({ duracao_ms: 120 })
  })
})

describe("linhaDoTempo · último passo", () => {
  const com = (over: Partial<Run>) =>
    passosDe(
      montar(run(over), [
        etapa({ tipo: "tool", nome: "casa.ler", resumo: "1 confirmados, 0 incertos" }),
      ]),
    )
  const ultimo = (over: Partial<Run>) => com(over).at(-1)?.frase

  it("done com sugestões do agente", () => {
    expect(ultimo({ saida: { origem: "agente", sugestoes: [{}, {}] } })).toBe(
      "Entreguei a resposta com 2 sugestões.",
    )
    expect(ultimo({ saida: { origem: "agente", sugestoes: [{}] } })).toBe(
      "Entreguei a resposta com 1 sugestão.",
    )
    expect(ultimo({ saida: { origem: "agente", sugestoes: [] } })).toBe("Entreguei a resposta.")
  })

  it("done segura, sem modelo e por código", () => {
    expect(ultimo({ saida: { origem: "segura", sugestoes: [] } })).toBe(
      "Entreguei uma resposta segura.",
    )
    expect(ultimo({ saida: { origem: "sem_modelo", sugestoes: [] } })).toBe(
      "Sem modelo disponível, montei a resposta por código.",
    )
    expect(ultimo({ saida: { origem: "codigo", sugestoes: [] } })).toBe(
      "Respondi direto, sem o agente.",
    )
  })

  it("done com saída inválida", () => {
    expect(ultimo({ saida: { origem: "inventada" } })).toBe("Entreguei a resposta.")
    expect(ultimo({ saida: null })).toBe("Entreguei a resposta.")
  })

  it("falhou, expirou e cancelou", () => {
    expect(ultimo({ status: "failed" })).toBe("Não consegui terminar.")
    expect(ultimo({ status: "expired" })).toBe("A pergunta expirou.")
    expect(ultimo({ status: "cancelled" })).toBe("Você seguiu a conversa.")
  })

  it("conversa apagada tem prioridade", () => {
    expect(ultimo({ fora_da_conversa: true, saida: { origem: "agente", sugestoes: [{}] } })).toBe(
      "A conversa deste dia foi apagada.",
    )
  })
})

describe("linhaDoTempo · saída", () => {
  it("é função pura: a mesma entrada dá a mesma saída", () => {
    const r = run()
    const e = [etapa({ tipo: "validacao", nome: "finalizar", resumo: "ok" })]
    expect(montar(r, e)).toEqual(montar(r, e))
  })
})
