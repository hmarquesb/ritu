import { describe, expect, it } from "vitest"
import { saidaSegura } from "@/core/agents/companion/saida"
import type { LlmClient } from "@/core/llm/client"
import type { Caminho } from "@/core/runs/ports"
import { diaLocal } from "@/core/time/dia-local"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { cenariosDeConversa } from "./index"
import { montarCenario } from "./montar"
import type { Cenario } from "./tipos"

const AGORA = "2026-06-15T22:00:00.000Z"

const cha = {
  tipo: "cha" as const,
  pratica_id: "cha-gengibre-canela",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre com canela",
}

const refeicao = {
  tipo: "refeicao" as const,
  preparo_id: "arroz-com-legume",
  alimentos: ["arroz-branco", "abobora"],
  titulo: "Arroz bem cozido com abóbora e ghee",
}

const base: Omit<Cenario, "nome" | "descricao"> = {
  agora: AGORA,
  perfil: {},
  casa: [],
  roteiro: [],
  mensagem: { texto: "oi", atalhos: [] },
}

describe("montarCenario: retornos e mensagens anteriores", () => {
  it("cria os retornos aguardando e o mais recente fica na frente", async () => {
    const c: Cenario = {
      ...base,
      nome: "retornos",
      descricao: "dois retornos",
      retornos: [
        { sugestao: refeicao, diasAtras: 2 },
        { sugestao: cha, diasAtras: 0 },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.map((r) => r.sugestao.titulo)).toEqual([cha.titulo, refeicao.titulo])
    expect(pendentes.every((r) => r.status === "aguardando")).toBe(true)
  })

  it("retornosSemeados traz os ids na ordem de Cenario.retornos", async () => {
    const c: Cenario = {
      ...base,
      nome: "semeados",
      descricao: "dois retornos semeados",
      retornos: [
        { sugestao: refeicao, diasAtras: 2 },
        { sugestao: cha, diasAtras: 0 },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    const idDe = (titulo: string) => pendentes.find((r) => r.sugestao.titulo === titulo)?.id
    expect(deps.retornosSemeados).toEqual([idDe(refeicao.titulo), idDe(cha.titulo)])
  })

  it("grava as mensagens anteriores no dia, com o caminho de cada run", async () => {
    const c: Cenario = {
      ...base,
      nome: "mensagens",
      descricao: "duas mensagens",
      mensagens: [
        { autor: "pessoa", texto: "oi" },
        { autor: "agente", texto: "olá", caminho: "ofensa" },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const dia = diaLocal(new Date(AGORA))
    const doDia = await deps.stores.messages.doDia(contaId, dia)
    expect(doDia.map((m) => [m.autor, m.texto])).toEqual([
      ["pessoa", "oi"],
      ["agente", "olá"],
    ])
    const caminhos: (Caminho | undefined)[] = []
    for (const m of doDia) {
      const run = m.run_id ? await deps.stores.runs.buscar(contaId, m.run_id) : undefined
      expect(run?.status).toBe("done")
      caminhos.push(run?.caminho)
    }
    expect(caminhos).toEqual(["acompanhante", "ofensa"])
  })

  it("sem entrada e sem mensagem, lança erro", async () => {
    const c: Cenario = {
      nome: "vazio",
      descricao: "sem nada",
      agora: AGORA,
      perfil: {},
      casa: [],
      roteiro: [],
    }
    await expect(montarCenario(c)).rejects.toThrow()
  })
})

describe("cenários de conversa", () => {
  const esperados: Record<string, Caminho> = {
    "casa-sozinha": "casa",
    "retorno-conversa": "retorno",
    "evitar-sozinho": "evitar",
    "alerta-emocional": "alerta",
    ofensa: "ofensa",
    "duas-intencoes": "acompanhante",
    "so-atalhos": "acompanhante",
  }

  it("são os sete da lista", () => {
    expect(Object.keys(cenariosDeConversa).sort()).toEqual(Object.keys(esperados).sort())
  })

  it.each(Object.keys(esperados))("%s termina pelo caminho da tabela", async (nome) => {
    const c = cenariosDeConversa[nome]
    if (!c?.mensagem) throw new Error(`cenário sem mensagem: ${nome}`)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)
    const comBloco = ["casa-sozinha", "evitar-sozinho", "duas-intencoes", "so-atalhos"].includes(
      nome,
    )
    expect(r.status).toBe(comBloco ? "waiting_for_approval" : "done")
    expect(r.caminho).toBe(esperados[nome])
  })

  it("duas-intencoes e so-atalhos chegam ao Acompanhante e a resposta vem do agente", async () => {
    for (const nome of ["duas-intencoes", "so-atalhos"]) {
      const c = cenariosDeConversa[nome]
      if (!c?.mensagem) throw new Error(`cenário sem mensagem: ${nome}`)
      const { contaId, deps } = await montarCenario(c)
      const r = await deps.conversation.conversar(contaId, c.mensagem)
      expect(r.saida?.origem).toBe("agente")
    }
  })

  it("retorno-conversa fecha o chá, que é o pendente 1", async () => {
    const c = cenariosDeConversa["retorno-conversa"]
    if (!c?.mensagem) throw new Error("cenário sem mensagem: retorno-conversa")
    const { contaId, deps } = await montarCenario(c)
    await deps.conversation.conversar(contaId, c.mensagem)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.map((r) => r.sugestao.titulo)).toEqual([refeicao.titulo])
  })
})

const DIA_MS = 86_400_000
const FRIO_AGITADA = ["com_frio", "agitada"] as const
const CHA_DO_HISTORICO = {
  tipo: "cha" as const,
  pratica_id: "cha-gengibre-canela",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre com canela",
}
const CHAVE_DO_CHA = "com_frio+agitada|pratica:cha-gengibre-canela"

// Histórico do chá (mesmo formato do job.test.ts): 3 ajudou e 1 nao_ajudou juntos, e 4 dias sozinhos.
function historicoDoCha(): NonNullable<Cenario["historico"]> {
  const juntos = [2, 3, 4, 5].map((diasAtras, i) => ({
    diasAtras,
    estados: [...FRIO_AGITADA],
    sugestao: CHA_DO_HISTORICO,
    resultado: i === 3 ? ("nao_ajudou" as const) : ("ajudou" as const),
  }))
  const sozinhos = [
    { diasAtras: 6, estados: ["com_frio" as const] },
    { diasAtras: 7, estados: ["com_frio" as const] },
    { diasAtras: 8, estados: ["agitada" as const] },
    { diasAtras: 9, estados: ["agitada" as const] },
  ]
  return [...juntos, ...sozinhos]
}

describe("montarCenario: rotina, histórico, padrões e Memória", () => {
  it("duas notas viram duas ativas, e o resumo é a versão 1 com a mais recente primeiro", async () => {
    const c: Cenario = {
      ...base,
      nome: "rotina",
      descricao: "duas notas",
      rotina: [
        { texto: "você almoça fora durante a semana", diasAtras: 5 },
        { texto: "você voltou a almoçar em casa", diasAtras: 1 },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const ativas = await deps.stores.routine.notasAtivas(contaId)
    expect(ativas.map((n) => n.texto).sort()).toEqual([
      "você almoça fora durante a semana",
      "você voltou a almoçar em casa",
    ])
    const resumo = await deps.stores.routine.resumo(contaId)
    expect(resumo?.versao).toBe(1)
    expect(resumo?.texto).toBe("Você voltou a almoçar em casa. Você almoça fora durante a semana.")
  })

  it("sem notas, não há resumo de rotina", async () => {
    const { contaId, deps } = await montarCenario({ ...base, nome: "sem-rotina", descricao: "x" })
    expect(await deps.stores.routine.resumo(contaId)).toBeUndefined()
  })

  it("histórico com sugestão e resultado vira run done com momento e retorno respondido", async () => {
    const c: Cenario = {
      ...base,
      nome: "historico",
      descricao: "um dia com chá ajudou",
      historico: [
        {
          diasAtras: 3,
          estados: [...FRIO_AGITADA],
          sugestao: CHA_DO_HISTORICO,
          resultado: "ajudou",
        },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const desde = new Date(Date.parse(AGORA) - 10 * DIA_MS)
    const runs = await deps.stores.runs.recentes(contaId, desde, 10)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      status: "done",
      com_incomodo: false,
      momento: { estados: [...FRIO_AGITADA], momento_do_dia: "noite", gunas_buscadas: [] },
      dia: diaLocal(new Date(Date.parse(AGORA) - 3 * DIA_MS)),
    })
    const respondidos = await deps.stores.outcomes.respondidosDesde(contaId, desde)
    expect(respondidos).toHaveLength(1)
    expect(respondidos[0]).toMatchObject({ resultado: "ajudou", origem: "toque" })
    expect(await deps.stores.outcomes.pendentes(contaId)).toHaveLength(0)
  })

  it("histórico sem sugestão grava só o run, sem retorno", async () => {
    const c: Cenario = {
      ...base,
      nome: "historico-sem-sugestao",
      descricao: "só estados",
      historico: [{ diasAtras: 2, estados: ["agitada"] }],
    }
    const { contaId, deps } = await montarCenario(c)
    const desde = new Date(Date.parse(AGORA) - 10 * DIA_MS)
    expect(await deps.stores.runs.recentes(contaId, desde, 10)).toHaveLength(1)
    expect(await deps.stores.outcomes.respondidosDesde(contaId, desde)).toHaveLength(0)
    expect(await deps.stores.outcomes.pendentes(contaId)).toHaveLength(0)
  })

  it('padrão confirmado aparece em listar(contaId, "confirmado")', async () => {
    const c: Cenario = {
      ...base,
      nome: "padrao",
      descricao: "um padrão confirmado",
      padroes: [
        {
          tipo: "estados_juntos",
          chave: "agitada>com_frio",
          frase: "Quando você está agitada, costuma estar com frio.",
          ocorrencias: 4,
          status: "confirmado",
        },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const confirmados = await deps.stores.patterns.listar(contaId, "confirmado")
    expect(confirmados.map((p) => p.frase)).toEqual([
      "Quando você está agitada, costuma estar com frio.",
    ])
  })

  it("padrão recusado e candidato também são semeados no status pedido", async () => {
    const c: Cenario = {
      ...base,
      nome: "padroes",
      descricao: "recusado e candidato",
      padroes: [
        {
          tipo: "estados_juntos",
          chave: "agitada>com_frio",
          frase: "Um.",
          ocorrencias: 3,
          status: "recusado",
        },
        {
          tipo: "estados_juntos",
          chave: "com_frio>agitada",
          frase: "Dois.",
          ocorrencias: 3,
          status: "candidato",
        },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    expect((await deps.stores.patterns.listar(contaId, "recusado")).map((p) => p.frase)).toEqual([
      "Um.",
    ])
    expect((await deps.stores.patterns.listar(contaId, "candidato")).map((p) => p.frase)).toEqual([
      "Dois.",
    ])
  })

  it("com detectar, o histórico do chá propõe um candidato com a chave do par", async () => {
    const c: Cenario = {
      ...base,
      nome: "detectar",
      descricao: "chá",
      historico: historicoDoCha(),
      detectar: true,
    }
    const { contaId, deps } = await montarCenario(c)
    const candidatos = await deps.stores.patterns.listar(contaId, "candidato")
    expect(candidatos.map((p) => p.chave)).toEqual([CHAVE_DO_CHA])
  })

  it("sem detectar, o histórico do chá não propõe nada", async () => {
    const c: Cenario = {
      ...base,
      nome: "sem-detectar",
      descricao: "chá",
      historico: historicoDoCha(),
    }
    const { contaId, deps } = await montarCenario(c)
    expect(await deps.stores.patterns.listar(contaId)).toHaveLength(0)
  })

  it("memoria com resumo: a Memória devolve o resumo com origem modelo", async () => {
    const c: Cenario = {
      ...base,
      nome: "memoria",
      descricao: "resumo",
      memoria: { resumo: "Você almoça fora e trabalha em casa." },
    }
    const { deps } = await montarCenario(c)
    const r = await deps.memory.resumir([{ texto: "trabalho em casa", criado_em: AGORA }])
    expect(r).toMatchObject({ origem: "modelo", texto: "Você almoça fora e trabalha em casa." })
  })

  it('memoria "sem_modelo": a Memória cai no código, sem modelo', async () => {
    const c: Cenario = {
      ...base,
      nome: "memoria-sem-modelo",
      descricao: "sem modelo",
      memoria: "sem_modelo",
    }
    const { deps } = await montarCenario(c)
    const r = await deps.memory.resumir([{ texto: "trabalho em casa", criado_em: AGORA }])
    expect(r).toMatchObject({ origem: "codigo", texto: "Trabalho em casa." })
    expect(r.modelo).toBeUndefined()
  })

  it("sem memoria, a Memória cai no código", async () => {
    const { deps } = await montarCenario({ ...base, nome: "sem-memoria", descricao: "x" })
    const r = await deps.memory.resumir([{ texto: "trabalho em casa", criado_em: AGORA }])
    expect(r.origem).toBe("codigo")
  })

  it("com llm passado nas opções, a Memória usa esse cliente", async () => {
    const c: Cenario = {
      ...base,
      nome: "memoria-llm",
      descricao: "x",
      memoria: { resumo: "Outro resumo." },
    }
    const llm = createFakeLlm([{ resumo: "Você almoça fora." }])
    const { deps } = await montarCenario(c, { llm })
    const r = await deps.memory.resumir([{ texto: "almoço fora", criado_em: AGORA }])
    expect(r).toMatchObject({ origem: "modelo", texto: "Você almoça fora." })
  })
})

describe("montarCenario: Juiz roteirizado", () => {
  const interpretacao = {
    intencoes: ["vida"] as ("vida" | "casa")[],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  }
  const entrada = { saida: saidaSegura(), evitar: [], tentativa: 1 }

  it("cada julgamento tira a próxima resposta: reprova com promessa, sem modelo, depois aprova", async () => {
    const c: Cenario = {
      ...base,
      nome: "juiz-fila",
      descricao: "reprova, sem modelo e aprova",
      juiz: [{ apontamentos: [{ motivo: "promessa", trecho: "x" }] }, "sem_modelo"],
    }
    const { deps } = await montarCenario(c)

    const primeiro = await deps.judge.julgar(entrada)
    expect(primeiro).toMatchObject({ ok: true, aprovado: false, graves: ["promessa"] })

    const segundo = await deps.judge.julgar(entrada)
    expect(segundo).toMatchObject({ ok: false, motivo: "sem_modelo" })

    const terceiro = await deps.judge.julgar(entrada)
    expect(terceiro).toMatchObject({ ok: true, aprovado: true, graves: [] })
  })

  it("sem juiz no cenário, o Juiz aprova", async () => {
    const { deps } = await montarCenario({ ...base, nome: "juiz-vazio", descricao: "x" })

    await expect(deps.judge.julgar(entrada)).resolves.toMatchObject({ ok: true, aprovado: true })
  })

  it("o Juiz não consome a fila do Intérprete do cenário", async () => {
    const c: Cenario = {
      ...base,
      nome: "juiz-e-interprete",
      descricao: "x",
      mensagem: { texto: "não aguento mais", atalhos: [] },
      interpretacao,
      juiz: [{ apontamentos: [{ motivo: "tom", trecho: "y" }] }],
    }
    const { deps } = await montarCenario(c)

    await deps.judge.julgar(entrada)
    await deps.judge.julgar(entrada)

    expect((deps.llm as LlmClient & { pedidos: unknown[] }).pedidos).toHaveLength(0)
    const r = await deps.interpreter.interpretar({
      texto: "não aguento mais",
      atalhos: [],
      conversa: [],
      pendentes: [],
    })
    expect(r).toMatchObject({ ok: true, interpretacao: { intencoes: ["vida"] } })
  })

  it("com llm nas opções, o Juiz usa esse cliente", async () => {
    const llm = createFakeLlm([{ apontamentos: [{ motivo: "dosagem", trecho: "z" }] }])
    const c: Cenario = { ...base, nome: "juiz-llm", descricao: "x" }
    const { deps } = await montarCenario(c, { llm })

    await expect(deps.judge.julgar(entrada)).resolves.toMatchObject({
      ok: true,
      aprovado: false,
      graves: ["dosagem"],
    })
  })
})
