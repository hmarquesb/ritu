import { describe, expect, it } from "vitest"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { Anotacao, SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Run, RunEtapa } from "@/core/runs/ports"
import { type DadosDoRelatorio, formatarRelatorio } from "./demo-report"

const DISCLAIMER = "Não é orientação médica."

function interpretacaoDeExemplo(): Interpretacao {
  return {
    intencoes: ["casa", "retorno"],
    estados: ["com_frio"],
    itens_casa: [
      { alimento_id: "gengibre", nome: "Gengibre", acao: "tem" },
      { nome: "Leite", acao: "acabou" },
    ],
    retorno: { resultado: "ajudou", retorno_id: "r-1", titulo: "Chá de gengibre" },
    evitar: [{ tipo: "texto", valor: "salada crua" }],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  }
}

function anotacoesDeExemplo(): Anotacao[] {
  return [
    { tipo: "casa_tem", itens: [{ alimento_id: "gengibre", nome: "Gengibre" }] },
    { tipo: "casa_acabou", itens: [{ nome: "Leite" }] },
  ]
}

function etapa(ordem: number, tipo: string, nome: string, resumo: string | null): RunEtapa {
  return {
    run_id: "run-1",
    ordem,
    tipo,
    nome,
    resumo,
    status: "ok",
    duracao_ms: 10,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
    criado_em: "2026-06-15T22:00:00.000Z",
  }
}

function saidaDeExemplo(): SaidaDoAcompanhante {
  return {
    anotacoes: [],
    propostas: [],
    origem: "agente",
    resposta: "Um chá de gengibre com canela agora ajuda a aquecer.",
    geral: false,
    avisos: [{ tipo: "geral", texto: "Resposta geral, sem os seus dados." }],
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [
      {
        tipo: "cha",
        titulo: "Chá de gengibre e canela",
        como_fazer: "Ferva a água com o gengibre e a canela por cinco minutos.",
        itens: [
          {
            alimento_id: "gengibre",
            nome: "Gengibre",
            contribui: ["quente"],
            verbos: ["aquecer"],
            linha_base: "Gengibre aquece.",
            casa: "confirmado",
          },
          {
            alimento_id: "cardamomo",
            nome: "Cardamomo",
            contribui: ["quente"],
            verbos: ["aquecer"],
            linha_base: "Cardamomo aquece.",
            casa: "incerto",
            se_faltar: {
              alimento_id: "canela",
              nome: "Canela",
              frase: "Se faltar, use canela, que aquece de forma parecida.",
            },
          },
        ],
        verbos: ["aquecer"],
        motivo: "Você disse que está com frio.",
        linhas_base: ["Gengibre aquece."],
        novidade: false,
      },
    ],
    evitar: [{ texto: "Salada crua à noite.", linha_base: "Cru pesa à noite." }],
    incertos: [],
    citados: [],
    para_ter: {
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      vezes: 3,
      contribui: ["quente"],
      linha_base: "Cardamomo aquece.",
      verbos: ["aquecer"],
      motivo: "Faltou 3 vezes nos últimos dias.",
    },
  }
}

function dadosDeExemplo(): DadosDoRelatorio {
  const resposta: RespostaDoRun = {
    run_id: "run-1",
    status: "done",
    saida: saidaDeExemplo(),
    fim: "entregue",
  }
  const run: Pick<
    Run,
    | "status"
    | "passos"
    | "tokens_entrada"
    | "tokens_saida"
    | "modelos"
    | "trocas_de_modelo"
    | "trace_id"
  > = {
    status: "done",
    passos: 4,
    tokens_entrada: 400,
    tokens_saida: 80,
    modelos: { decisao: ["gemini-3.5-flash-lite"] },
    trocas_de_modelo: 1,
    trace_id: "abc123",
  }
  return {
    nome: "frio-agitada",
    resposta,
    run,
    etapas: [
      etapa(1, "tool", "clima.agora", "faixa fria"),
      etapa(2, "tool", "casa.ler", "5 itens em casa"),
      etapa(3, "validacao", "finalizar", null),
    ],
    pensamentos: [{ depoisDaOrdem: 1, texto: "Vou montar a sugestão com o que tenho." }],
    disclaimer: DISCLAIMER,
  }
}

describe("formatarRelatorio", () => {
  it("mostra todas as seções na ordem", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    const marcas = [
      "Etapas",
      "Resposta",
      "Sugestões",
      "Evite agora",
      "Vale ter em casa",
      "Avisos",
      DISCLAIMER,
      "Resumo",
    ]
    const posicoes = marcas.map((m) => texto.indexOf(m))
    for (const posicao of posicoes) expect(posicao).toBeGreaterThanOrEqual(0)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
  })

  it("põe o pensamento entre aspas antes da tool seguinte", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    const pensamento = texto.indexOf('"Vou montar a sugestão com o que tenho."')
    const ferramenta = texto.indexOf("casa.ler")
    expect(pensamento).toBeGreaterThanOrEqual(0)
    expect(pensamento).toBeLessThan(ferramenta)
    expect(texto.indexOf("clima.agora")).toBeLessThan(pensamento)
  })

  it("marca o ingrediente incerto e mostra a frase de troca", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    expect(texto).toMatch(/Cardamomo.*incerto/)
    expect(texto).toContain("Se faltar, use canela, que aquece de forma parecida.")
  })

  it("mostra o título, o motivo, os verbos e o modo de fazer da sugestão", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    expect(texto).toContain("Chá de gengibre e canela")
    expect(texto).toContain("Você disse que está com frio.")
    expect(texto).toContain("aquecer")
    expect(texto).toContain("Ferva a água com o gengibre e a canela por cinco minutos.")
  })

  it("traz o aviso médico, o evitar, o vale ter e o resumo do run", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    expect(texto).toContain("Salada crua à noite.")
    expect(texto).toContain("Cardamomo")
    expect(texto).toContain("Faltou 3 vezes nos últimos dias.")
    expect(texto).toContain("Resposta geral, sem os seus dados.")
    expect(texto).toContain("status: done")
    expect(texto).toContain("origem: agente")
    expect(texto).toContain("passos: 4")
    expect(texto).toContain("tokens: 480 (entrada 400, saída 80)")
    expect(texto).toContain("modelo: gemini-3.5-flash-lite")
    expect(texto).toContain("trocas de modelo: 1")
    expect(texto).toContain("trace_id: abc123")
  })

  it("mostra o bloco Entendi com o caminho, as intenções, a casa, o retorno e o evitar", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      caminho: "casa",
      interpretacao: interpretacaoDeExemplo(),
    })
    expect(texto).toContain("Entendi")
    expect(texto).toContain("caminho: casa")
    expect(texto).toContain("intenções: casa, retorno")
    expect(texto).toContain("estados: com_frio")
    expect(texto).toContain("Gengibre (tem), Leite (acabou)")
    expect(texto).toContain("retorno: ajudou · Chá de gengibre")
    expect(texto).toContain("evitar: salada crua")
    expect(texto.indexOf("Entendi")).toBeLessThan(texto.indexOf("Etapas"))
  })

  it("diz sem ligação quando o retorno não está ligado a um registro", () => {
    const interpretacao = {
      ...interpretacaoDeExemplo(),
      retorno: { resultado: "nao_ajudou" as const },
    }
    const texto = formatarRelatorio({ ...dadosDeExemplo(), caminho: "retorno", interpretacao })
    expect(texto).toContain("retorno: nao_ajudou (sem ligação)")
  })

  it("não mostra linha vazia no Entendi quando o campo não foi citado", () => {
    const interpretacao = { ...interpretacaoDeExemplo(), itens_casa: [], retorno: undefined }
    const texto = formatarRelatorio({ ...dadosDeExemplo(), caminho: "casa", interpretacao })
    expect(texto).not.toContain("\n  em casa:")
    expect(texto).not.toContain("\n  retorno:")
  })

  it("nomeia o evitar com a função dada e o valor quando não há nome", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      caminho: "evitar",
      interpretacao: {
        ...interpretacaoDeExemplo(),
        evitar: [{ tipo: "grupo", valor: "amendoim" }],
      },
      nomeDoEvitar: (item) => (item.valor === "amendoim" ? "Amendoim" : item.valor),
    })
    expect(texto).toContain("evitar: Amendoim")
  })

  it("mostra Posso anotar depois da resposta, uma linha por anotação, com o tipo e os nomes", () => {
    const saida = { ...saidaDeExemplo(), anotacoes: anotacoesDeExemplo() }
    const dados = dadosDeExemplo()
    const texto = formatarRelatorio({ ...dados, resposta: { ...dados.resposta, saida } })
    expect(texto).toContain("Posso anotar")
    expect(texto).toContain("tem em casa: Gengibre")
    expect(texto).toContain("acabou em casa: Leite")
    expect(texto.indexOf("Posso anotar")).toBeGreaterThan(texto.indexOf("Resposta"))
    expect(texto.indexOf("Posso anotar")).toBeLessThan(texto.indexOf("Avisos"))
  })

  it("não mostra Entendi nem Posso anotar num run da 007", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    expect(texto).not.toContain("Entendi")
    expect(texto).not.toContain("Posso anotar")
  })

  it("mostra os modelos de apoio do Intérprete no resumo", () => {
    const dados = dadosDeExemplo()
    const texto = formatarRelatorio({
      ...dados,
      run: { ...dados.run, modelos: { decisao: ["gemini-a"], apoio: ["gemini-b"] } },
    })
    expect(texto).toContain("modelo: gemini-a")
    expect(texto).toContain("apoio: gemini-b")
  })

  it("diz nada agora quando não há evitar nem vale ter em casa", () => {
    const dados = dadosDeExemplo()
    const saida = { ...saidaDeExemplo(), evitar: [], para_ter: undefined, avisos: [] }
    const texto = formatarRelatorio({
      ...dados,
      resposta: { ...dados.resposta, saida },
    })
    expect(texto).toContain("Vale ter em casa: nada agora")
    expect(texto).toContain("Avisos: nenhum")
  })
})

describe("formatarRelatorio · perguntas", () => {
  const perguntaDeCasa: Pergunta = {
    tipo: "casa",
    texto: "Ainda tem abóbora e couve?",
    itens: [
      { alimento_id: "abobora", nome: "Abóbora" },
      { alimento_id: "couve", nome: "Couve" },
    ],
  }
  const respostaDeCasa: RespostaDaPessoa = {
    tipo: "casa",
    itens: [
      { alimento_id: "abobora", resposta: "tenho" },
      { alimento_id: "couve", resposta: "nao_tenho" },
    ],
  }

  it("mostra o bloco Pergunta com as opções e a linha da resposta, antes da resposta final", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      perguntas: [{ pergunta: perguntaDeCasa, resposta: respostaDeCasa }],
    })
    expect(texto).toContain("Pergunta\n  Ainda tem abóbora e couve?")
    expect(texto).toContain("1. Abóbora  [t] Tenho")
    expect(texto).toContain("Resposta: Tenho: abóbora · Não tenho: couve")
    expect(texto.indexOf("Etapas")).toBeLessThan(texto.indexOf("Pergunta\n"))
    expect(texto.indexOf("Pergunta\n")).toBeLessThan(texto.indexOf("\nResposta\n"))
  })

  it("não mostra o bloco Pergunta quando o run não teve pausa", () => {
    const texto = formatarRelatorio({ ...dadosDeExemplo(), perguntas: [] })
    expect(texto).not.toMatch(/^Pergunta$/m)
    expect(texto).not.toContain("Resposta: ")
  })

  it("aceita a resposta final sem saída, de run que terminou em espera", () => {
    const dados = dadosDeExemplo()
    const texto = formatarRelatorio({
      ...dados,
      resposta: { run_id: "run-1" },
      run: { ...dados.run, status: "waiting_for_input" },
      perguntas: [{ pergunta: perguntaDeCasa, resposta: respostaDeCasa }],
    })
    expect(texto).toContain("status: waiting_for_input")
    expect(texto).toContain("origem: pausa")
  })
})
