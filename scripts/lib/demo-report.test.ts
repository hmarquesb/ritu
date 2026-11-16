import { describe, expect, it } from "vitest"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Run, RunEtapa } from "@/core/runs/ports"
import {
  type DadosDoRelatorio,
  type DecisaoDoBloco,
  formatarRelatorio,
  fraseDaTrocaNaSugestao,
  linhaDoToque,
  motivoDaLista,
  motivosDoJuizDasEtapas,
  type TocadoDoRelatorio,
} from "./demo-report"

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

const propostaDaCasa: PropostaNaSaida = {
  id: "p1",
  tool: "casa.propor",
  texto: "Você tem abóbora em casa",
}
const propostaDeGosto: PropostaNaSaida = {
  id: "p2",
  tool: "memoria.propor",
  texto: "Você gosta de couve",
}
const propostasDoBloco: PropostaNaSaida[] = [propostaDaCasa, propostaDeGosto]

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
    | "juiz_tentativas"
    | "juiz_aprovado"
  > = {
    status: "done",
    passos: 4,
    tokens_entrada: 400,
    tokens_saida: 80,
    modelos: { decisao: ["gemini-3.5-flash-lite"] },
    trocas_de_modelo: 1,
    trace_id: "abc123",
    juiz_tentativas: 0,
    juiz_aprovado: null,
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

  it("não mostra mais a seção Posso anotar das anotações, mesmo com anotações na saída", () => {
    const dados = dadosDeExemplo()
    const saida = {
      ...saidaDeExemplo(),
      anotacoes: [
        { tipo: "casa_tem" as const, itens: [{ alimento_id: "gengibre", nome: "Gengibre" }] },
      ],
    }
    const texto = formatarRelatorio({ ...dados, resposta: { ...dados.resposta, saida } })
    expect(texto).not.toContain("tem em casa: Gengibre")
    expect(texto).not.toContain("Posso anotar\n")
  })

  it("não mostra Entendi nem o bloco de aprovação num run da 007", () => {
    const texto = formatarRelatorio(dadosDeExemplo())
    expect(texto).not.toContain("Entendi")
    expect(texto).not.toContain("Posso anotar isto?")
    expect(texto).not.toContain("Bloco aberto")
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

describe("formatarRelatorio · bloco de aprovação", () => {
  function dadosComBloco(
    extra: Partial<Pick<DadosDoRelatorio, "decisao" | "minhaCasa" | "depois">> = {},
    propostas: PropostaNaSaida[] = propostasDoBloco,
  ): DadosDoRelatorio {
    const dados = dadosDeExemplo()
    const saida = { ...saidaDeExemplo(), propostas }
    return { ...dados, resposta: { ...dados.resposta, saida }, ...extra }
  }
  const decisaoParcial: DecisaoDoBloco = {
    aprovadas: 1,
    gravadas: [propostaDaCasa],
  }

  it("mostra o bloco depois da resposta, com a decisão e o gravado antes das sugestões", () => {
    const texto = formatarRelatorio(dadosComBloco({ decisao: decisaoParcial }))
    expect(texto).toContain(
      "Posso anotar isto?\n  1. [x] Você tem abóbora em casa\n  2. [x] Você gosta de couve\n[Agora não] [Anotar]",
    )
    expect(texto).toContain("Decisão: Anotar 1 de 2")
    expect(texto).toContain("Gravado:\n  - Você tem abóbora em casa")
    expect(texto.indexOf("\nResposta\n")).toBeLessThan(texto.indexOf("Posso anotar isto?"))
    expect(texto.indexOf("Gravado:")).toBeLessThan(texto.indexOf("Sugestões"))
  })

  it("com Agora não, a decisão diz Agora não e o gravado é nada", () => {
    const texto = formatarRelatorio(dadosComBloco({ decisao: { aprovadas: 0, gravadas: [] } }))
    expect(texto).toContain("Decisão: Agora não")
    expect(texto).toContain("Gravado: nada")
  })

  it("sem decisão, o bloco fica aberto", () => {
    const texto = formatarRelatorio(dadosComBloco())
    expect(texto).toContain("Posso anotar isto?")
    expect(texto).toContain("Bloco aberto")
    expect(texto).not.toContain("Decisão:")
  })

  it("sem propostas, nada do bloco aparece", () => {
    const texto = formatarRelatorio(dadosComBloco({}, []))
    expect(texto).not.toContain("Posso anotar isto?")
    expect(texto).not.toContain("Bloco aberto")
    expect(texto).not.toContain("Decisão:")
  })

  it("mostra Minha casa com nome e estado quando uma casa.propor foi gravada", () => {
    const texto = formatarRelatorio(
      dadosComBloco({
        decisao: decisaoParcial,
        minhaCasa: [
          { nome: "Abóbora", estado: "tem" },
          { nome: "Couve", estado: "acabou" },
        ],
      }),
    )
    expect(texto).toContain("Minha casa:\n  - Abóbora (tem)\n  - Couve (acabou)")
  })

  it("não mostra Minha casa quando a gravada não é da casa", () => {
    const texto = formatarRelatorio(
      dadosComBloco({
        decisao: { aprovadas: 1, gravadas: [propostaDeGosto] },
        minhaCasa: [{ nome: "Abóbora", estado: "tem" }],
      }),
    )
    expect(texto).toContain("Gravado:\n  - Você gosta de couve")
    expect(texto).not.toContain("Minha casa:")
  })

  it("com depois, mostra a linha Depois e o relatório da segunda mensagem", () => {
    const segundo = { ...dadosDeExemplo(), nome: "vegetariana" }
    const texto = formatarRelatorio(
      dadosComBloco({
        decisao: { aprovadas: 0, gravadas: [] },
        depois: { mensagem: "sou vegetariana, o que eu como agora?", relatorio: segundo },
      }),
    )
    const depois = texto.indexOf("Depois: sou vegetariana, o que eu como agora?")
    expect(depois).toBeGreaterThan(texto.indexOf("trace_id: abc123"))
    expect(texto.indexOf("Cenário: vegetariana")).toBeGreaterThan(depois)
  })
})

describe("formatarRelatorio · como ficou, gravado e toques", () => {
  it("sem nada novo, o relatório é igual ao de hoje", () => {
    const dados = dadosDeExemplo()
    const vazio = formatarRelatorio({
      ...dados,
      comoFicou: [],
      gravado: { faltas: 0, sugeridos: 0, lista: [] },
      toques: [],
    })
    expect(vazio).toBe(formatarRelatorio(dados))
    expect(vazio).not.toContain("Como ficou?")
    expect(vazio).not.toContain("Gravado")
    expect(vazio).not.toContain("Toques")
  })

  it("mostra Como ficou? com um título por linha", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      comoFicou: [{ titulo: "Chá de gengibre e canela" }, { titulo: "Arroz com abóbora" }],
    })
    expect(texto).toContain("Como ficou?\n  Chá de gengibre e canela\n  Arroz com abóbora")
  })

  it("sem retorno aguardando, a seção Como ficou? não aparece", () => {
    const texto = formatarRelatorio({ ...dadosDeExemplo(), comoFicou: [] })
    expect(texto).not.toContain("Como ficou?")
  })

  it("mostra Gravado com as faltas, os sugeridos e a lista com o motivo", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      gravado: {
        faltas: 2,
        sugeridos: 3,
        lista: [
          { nome: "Cardamomo", motivo: "Fez falta 3 vezes nos últimos 30 dias" },
          { nome: "Gengibre", motivo: "Faltou para chá de gengibre" },
        ],
      },
    })
    expect(texto).toContain("Gravado\n  2 faltas\n  3 itens marcados como sugeridos")
    expect(texto).toContain("  Lista Para ter em casa:\n    - Cardamomo · Fez falta 3 vezes")
    expect(texto).toContain("    - Gengibre · Faltou para chá de gengibre")
  })

  it("no singular, diz 1 falta e 1 item marcado como sugerido", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      gravado: { faltas: 1, sugeridos: 1, lista: [] },
    })
    expect(texto).toContain("Gravado\n  1 falta\n  1 item marcado como sugerido")
    expect(texto).not.toContain("Lista Para ter em casa:")
  })

  it("sem faltas, sugeridos nem lista, a seção Gravado não aparece", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      gravado: { faltas: 0, sugeridos: 0, lista: [] },
    })
    expect(texto).not.toContain("Gravado\n")
  })

  it("mostra Toques uma linha por toque, depois de Como ficou? e Gravado", () => {
    const texto = formatarRelatorio({
      ...dadosDeExemplo(),
      comoFicou: [{ titulo: "Arroz com abóbora" }],
      gravado: { faltas: 1, sugeridos: 0, lista: [] },
      toques: ["Retorno da sugestão 1: Ajudou", "Gosto de Couve: gosta"],
    })
    expect(texto).toContain("Toques\n  Retorno da sugestão 1: Ajudou\n  Gosto de Couve: gosta")
    expect(texto.indexOf("Como ficou?")).toBeLessThan(texto.indexOf("Gravado"))
    expect(texto.indexOf("Gravado")).toBeLessThan(texto.indexOf("Toques"))
  })
})

describe("formatarRelatorio · rotina e padrões", () => {
  const rotina = { versao: 2, texto: "Você acorda cedo e almoça em casa." }
  const padroes: NonNullable<DadosDoRelatorio["padroes"]> = [
    {
      frase: "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar.",
      status: "confirmado",
    },
    { frase: "Quando você está sem energia, costuma estar também pesada.", status: "candidato" },
  ]
  function dadosComBloco(extra: Partial<DadosDoRelatorio>): DadosDoRelatorio {
    const dados = dadosDeExemplo()
    const saida = { ...saidaDeExemplo(), propostas: propostasDoBloco }
    return {
      ...dados,
      resposta: { ...dados.resposta, saida },
      decisao: { aprovadas: 1, gravadas: [propostaDaCasa] },
      ...extra,
    }
  }

  it("sem rotina nem padrões, o relatório é igual ao de hoje", () => {
    const dados = dadosDeExemplo()
    const vazio = formatarRelatorio({ ...dados, rotina: undefined, padroes: [] })
    expect(vazio).toBe(formatarRelatorio(dados))
    expect(vazio).not.toContain("Rotina")
    expect(vazio).not.toContain("Padrões")
  })

  it("com rotina de texto vazio, a seção Rotina não aparece", () => {
    const texto = formatarRelatorio({ ...dadosDeExemplo(), rotina: { versao: 1, texto: "" } })
    expect(texto).not.toContain("Rotina")
  })

  it("mostra Rotina com a versão e o texto, antes da resposta", () => {
    const texto = formatarRelatorio({ ...dadosDeExemplo(), rotina })
    expect(texto).toContain("Rotina\n  v2: Você acorda cedo e almoça em casa.")
    expect(texto.indexOf("Rotina")).toBeLessThan(texto.indexOf("\nResposta\n"))
    expect(texto.indexOf("Etapas")).toBeLessThan(texto.indexOf("Rotina"))
  })

  it("sem padrão, a seção Padrões não aparece", () => {
    const texto = formatarRelatorio(dadosComBloco({ padroes: [] }))
    expect(texto).not.toContain("Padrões")
  })

  it("mostra Padrões com a frase e o status, depois da decisão do bloco", () => {
    const texto = formatarRelatorio(dadosComBloco({ padroes }))
    expect(texto).toContain(
      `Padrões\n  ${padroes[0]?.frase} · confirmado\n  ${padroes[1]?.frase} · candidato`,
    )
    expect(texto.indexOf("Decisão: Anotar 1 de 2")).toBeLessThan(texto.indexOf("Padrões"))
    expect(texto.indexOf("Padrões")).toBeLessThan(texto.indexOf("Sugestões"))
  })

  it("com depois, cada relatório mostra a rotina e os padrões do seu bloco", () => {
    const segundo = { ...dadosComBloco({ rotina: { versao: 3, texto: "Agora almoça fora." } }) }
    const texto = formatarRelatorio(
      dadosComBloco({
        rotina,
        padroes,
        depois: { mensagem: "e agora?", relatorio: segundo },
      }),
    )
    const depois = texto.indexOf("Depois: e agora?")
    expect(texto.indexOf("v2: Você acorda")).toBeLessThan(depois)
    expect(texto.indexOf("v3: Agora almoça fora.")).toBeGreaterThan(depois)
  })
})

describe("formatarRelatorio · Juiz e reforço", () => {
  function comJuiz(
    tentativas: number,
    aprovado: boolean | null,
    extra: Partial<DadosDoRelatorio> = {},
  ): DadosDoRelatorio {
    const dados = dadosDeExemplo()
    return {
      ...dados,
      run: { ...dados.run, juiz_tentativas: tentativas, juiz_aprovado: aprovado },
      ...extra,
    }
  }

  it("com juiz_tentativas 0, o relatório é igual ao de hoje", () => {
    const texto = formatarRelatorio(comJuiz(0, null))
    expect(texto).toBe(formatarRelatorio(dadosDeExemplo()))
    expect(texto).not.toContain("juiz:")
  })

  it("com uma tentativa aprovada, mostra a linha do Juiz depois de trocas de modelo", () => {
    const texto = formatarRelatorio(comJuiz(1, true))
    expect(texto).toContain("  juiz: 1 tentativa(s), aprovado\n")
    expect(texto).not.toContain("motivos")
    expect(texto.indexOf("trocas de modelo")).toBeLessThan(texto.indexOf("  juiz: 1"))
    expect(texto.indexOf("  juiz: 1")).toBeLessThan(texto.indexOf("trace_id"))
  })

  it("com duas tentativas reprovadas, mostra os motivos separados por vírgula", () => {
    const texto = formatarRelatorio(comJuiz(2, false, { motivosDoJuiz: ["promessa", "tom"] }))
    expect(texto).toContain("  juiz: 2 tentativa(s), reprovado; motivos: promessa, tom")
  })

  it("com juiz_aprovado nulo, diz indisponivel", () => {
    expect(formatarRelatorio(comJuiz(1, null))).toContain("  juiz: 1 tentativa(s), indisponivel")
  })

  it("com modelos de reforço, mostra a linha reforço logo depois de modelo", () => {
    const dados = dadosDeExemplo()
    const texto = formatarRelatorio({
      ...dados,
      run: {
        ...dados.run,
        modelos: { decisao: ["gemini-a"], reforco: ["gemini-r"] },
      },
    })
    expect(texto).toContain("  modelo: gemini-a\n  reforço: gemini-r\n")
  })

  it("sem modelos de reforço, a linha reforço não aparece", () => {
    expect(formatarRelatorio(dadosDeExemplo())).not.toContain("reforço")
  })

  it("motivosDoJuizDasEtapas lê os motivos dos resumos das etapas juiz, sem repetir", () => {
    const etapas = [
      etapa(1, "juiz", "juiz", "reprovado: promessa, tom; registros: jargao"),
      etapa(2, "juiz", "juiz", "reprovado: promessa; registros: saude_na_proposta"),
      etapa(3, "juiz", "juiz", "aprovado; registros: jargao"),
      etapa(4, "juiz", "juiz", "indisponivel"),
      etapa(5, "llm", "modelo", "reprovado: falso"),
    ]
    expect(motivosDoJuizDasEtapas(etapas)).toEqual([
      "promessa",
      "tom",
      "jargao",
      "saude_na_proposta",
    ])
    expect(motivosDoJuizDasEtapas([etapa(1, "juiz", "juiz", "aprovado")])).toEqual([])
  })

  it("aceita os resumos do Juiz sem espaço depois do ; e da , e descarta motivo vazio", () => {
    expect(motivosDoJuizDasEtapas([etapa(1, "juiz", "juiz", "reprovado: promessa,tom")])).toEqual([
      "promessa",
      "tom",
    ])
    expect(
      motivosDoJuizDasEtapas([etapa(1, "juiz", "juiz", "reprovado: promessa;registros: jargao")]),
    ).toEqual(["promessa", "jargao"])
    expect(
      motivosDoJuizDasEtapas([etapa(1, "juiz", "juiz", "reprovado: promessa, , tom")]),
    ).toEqual(["promessa", "tom"])
  })

  it("resumo nulo não tem motivo, e motivo repetido entre etapas aparece uma vez, na ordem do primeiro", () => {
    expect(
      motivosDoJuizDasEtapas([
        etapa(1, "juiz", "juiz", null),
        etapa(2, "juiz", "juiz", "reprovado: promessa"),
        etapa(3, "juiz", "juiz", "reprovado: tom; registros: promessa"),
      ]),
    ).toEqual(["promessa", "tom"])
  })
})

describe("linhaDoToque", () => {
  it("mostra o retorno com o resultado em português", () => {
    const ajudou: TocadoDoRelatorio = {
      tipo: "retorno",
      numero: 1,
      resultado: "ajudou",
      semeado: false,
    }
    const naoAjudou: TocadoDoRelatorio = {
      tipo: "retorno",
      numero: 2,
      resultado: "nao_ajudou",
      semeado: true,
    }
    const naoFez: TocadoDoRelatorio = {
      tipo: "retorno",
      numero: 3,
      resultado: "nao_fez",
      semeado: false,
    }
    expect(linhaDoToque(ajudou)).toBe("Retorno da sugestão 1: Ajudou")
    expect(linhaDoToque(naoAjudou)).toBe("Retorno semeado 2: Não ajudou")
    expect(linhaDoToque(naoFez)).toBe("Retorno da sugestão 3: Não fiz")
  })

  it("mostra o gosto como gosta, não gosta ou limpou", () => {
    const gosta: TocadoDoRelatorio = { tipo: "gosto", nome: "Couve", gosto: "gosta" }
    const naoGosta: TocadoDoRelatorio = { tipo: "gosto", nome: "Couve", gosto: "nao_gosta" }
    const limpou: TocadoDoRelatorio = { tipo: "gosto", nome: "Couve", gosto: null }
    expect(linhaDoToque(gosta)).toBe("Gosto de Couve: gosta")
    expect(linhaDoToque(naoGosta)).toBe("Gosto de Couve: não gosta")
    expect(linhaDoToque(limpou)).toBe("Gosto de Couve: limpou")
  })

  it("mostra a troca com a frase do substituto", () => {
    const troca: TocadoDoRelatorio = {
      tipo: "troca",
      motivo: "trocar",
      nome: "Canela",
      numero: 1,
      desfecho: "Se faltar, use cardamomo, que aquece de forma parecida.",
    }
    expect(linhaDoToque(troca)).toBe(
      "Trocar Canela na sugestão 1: Se faltar, use cardamomo, que aquece de forma parecida.",
    )
  })

  it("mostra o motivo Não tenho com o texto de sem substituto", () => {
    const semSubstituto: TocadoDoRelatorio = {
      tipo: "troca",
      motivo: "nao_tenho",
      nome: "Canela",
      numero: 1,
      desfecho: "Não achei uma troca para canela com o que você tem em casa.",
    }
    expect(linhaDoToque(semSubstituto)).toBe(
      "Não tenho Canela na sugestão 1: Não achei uma troca para canela com o que você tem em casa.",
    )
  })

  it("mostra a pergunta com a resposta e depois o desfecho", () => {
    const respondida: TocadoDoRelatorio = {
      tipo: "troca",
      motivo: "nao_gosto",
      nome: "Canela",
      numero: 2,
      pergunta: { texto: "Você tem cravo em casa?", resposta: "tenho" },
      desfecho: "Cravo aquece.",
    }
    expect(linhaDoToque(respondida)).toBe(
      "Não gosto Canela na sugestão 2: Pergunta: Você tem cravo em casa? → Tenho · Cravo aquece.",
    )
  })

  it("mostra a pergunta sem resposta quando a troca ainda não foi respondida", () => {
    const pendente: TocadoDoRelatorio = {
      tipo: "troca",
      motivo: "trocar",
      nome: "Canela",
      numero: 1,
      pergunta: { texto: "Você tem cravo em casa?" },
    }
    expect(linhaDoToque(pendente)).toBe(
      "Trocar Canela na sugestão 1: Pergunta: Você tem cravo em casa?",
    )
  })
})

describe("motivoDaLista", () => {
  it("diz quantas vezes fez falta nos últimos 30 dias", () => {
    expect(motivoDaLista({ motivo: "fez_falta", detalhe: "3" })).toBe(
      "Fez falta 3 vezes nos últimos 30 dias",
    )
  })

  it("diz para qual preparo faltou hoje", () => {
    expect(motivoDaLista({ motivo: "faltou_hoje", detalhe: "chá de gengibre" })).toBe(
      "Faltou para chá de gengibre",
    )
  })
})

describe("fraseDaTrocaNaSugestao", () => {
  it("acha a frase do item trocado pelo alimento que saiu", () => {
    const itens = [
      { alimento_id: "gengibre" },
      { alimento_id: "canela", troca: { frase: "Se faltar, use cravo.", anteriores: [] } },
    ]
    expect(fraseDaTrocaNaSugestao({ itens }, "canela")).toBe("Se faltar, use cravo.")
  })

  it("na segunda troca, acha a frase pelo alimento anterior na lista", () => {
    const itens = [
      {
        alimento_id: "canela",
        troca: { frase: "Se faltar, use noz-moscada.", anteriores: ["cravo"] },
      },
    ]
    expect(fraseDaTrocaNaSugestao({ itens }, "cravo")).toBe("Se faltar, use noz-moscada.")
  })

  it("sem troca no item, a frase é vazia", () => {
    expect(fraseDaTrocaNaSugestao({ itens: [{ alimento_id: "canela" }] }, "canela")).toBe("")
  })
})
