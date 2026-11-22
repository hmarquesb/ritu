import { describe, expect, it, vi } from "vitest"
import { saidaDoAcompanhanteSchema } from "@/core/agents/companion/saida"
import { type ConteudoDaProposta, lerConteudo } from "@/core/proposals/conteudo"
import {
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Bloco "Posso anotar isto?": as linhas que a resposta cria, a ordem, o teto, o que não se repete e os textos.
// Cenário base sem decisão: o bloco fica aberto, para olhar o que foi proposto.

const FATO = "essa semana você vai almoçar fora todo dia"
const ORDEM_DO_BLOCO = [
  "memoria.propor:evitar_sempre",
  "memoria.propor:restricao",
  "memoria.propor:nao_come",
  "memoria.propor:gosta",
  "casa.propor:tem",
  "casa.propor:acabou",
  "lista.propor",
  "memoria.propor:rotina",
]

function base(nome: string): CenarioDeConversa {
  const c = cenariosComAprovacao[nome] ?? cenariosDeConversa[nome] ?? cenariosComPausa[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return { ...c, aprovacao: undefined, depois: undefined }
}

function interpretacaoDe(c: CenarioDeConversa) {
  if (!c.interpretacao) throw new Error(`cenário ${c.nome} sem interpretação`)
  return c.interpretacao
}

// Roteiro com a rotina proposta antes da resposta final, como o agente faria com fato_de_rotina.
function comRotina(c: CenarioDeConversa): CenarioDeConversa["roteiro"] {
  const fim = c.roteiro[c.roteiro.length - 1]
  if (!fim) throw new Error("roteiro vazio")
  return [
    ...c.roteiro.slice(0, -1),
    {
      texto: "Vou propor guardar a rotina da semana, se a pessoa quiser.",
      chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
    },
    fim,
  ]
}

// O `para_ter` vai nos argumentos do `finalizar` roteirizado (o roteiro de frio-agitada tem um).
function temParaTer(c: CenarioDeConversa): boolean {
  return c.roteiro.some((passo) =>
    passo.chamadas?.some(
      (chamada) =>
        chamada.nome === "finalizar" &&
        "para_ter" in (chamada.argumentos as Record<string, unknown>),
    ),
  )
}

function semParaTer(c: CenarioDeConversa): CenarioDeConversa {
  return {
    ...c,
    roteiro: c.roteiro.map((passo) => ({
      ...passo,
      chamadas: passo.chamadas?.map((chamada) => {
        if (chamada.nome !== "finalizar") return chamada
        const { para_ter: _paraTer, ...argumentos } = chamada.argumentos as Record<string, unknown>
        return { ...chamada, argumentos }
      }),
    })),
  }
}

async function abrir(
  c: CenarioDeConversa,
  antes?: (deps: DepsDoCenario, contaId: string) => Promise<void>,
) {
  const { contaId, deps } = await montarCenario(c)
  if (antes) await antes(deps, contaId)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, rodada, runId: rodada.final.run_id }
}

function chave(c: ConteudoDaProposta): string {
  if (c.tool === "casa.propor") return `casa.propor:${c.acao}`
  if (c.tool === "memoria.propor") return `memoria.propor:${c.tipo}`
  return c.tool
}

// Ferramentas (chave) das linhas gravadas do run, na ordem em que foram criadas.
async function tiposDoBloco(deps: DepsDoCenario, contaId: string, runId: string) {
  const doRun = await deps.stores.proposals.doRun(contaId, runId)
  return doRun.map((p) => {
    const c = lerConteudo(p.tool, p.conteudo)
    return c ? chave(c) : `invalida:${p.tool}`
  })
}

// Os oito tipos de anotação de uma mensagem só: casa tem e acabou, evitar, não como, gosta, restrição,
// lista (faltou hoje, pelo agente) e rotina (pelo agente). Com teto de 6, lista e rotina ficam de fora.
const OITO_TIPOS: CenarioDeConversa = (() => {
  const c = base("faltou-hoje")
  return {
    ...c,
    mensagem: {
      texto:
        "comprei abóbora, a couve acabou, não como leite, gosto de canela, não posso comer camarão, sou vegana",
      atalhos: [],
    },
    interpretacao: {
      intencoes: ["momento", "casa", "evitar"],
      estados: ["com_frio"],
      itens_casa: [
        { nome: "abóbora", acao: "tem" },
        { nome: "couve", acao: "acabou" },
      ],
      evitar_sempre: ["camarão"],
      nao_come: ["leite"],
      gosta: ["canela"],
      restricoes: ["vegana"],
      fato_de_rotina: FATO,
      suspeito: false,
    },
    roteiro: comRotina(c),
  }
})()

describe("bloco: uma linha por anotação, com o texto que a pessoa lê", () => {
  it("comprei abóbora, couve e arroz gera uma linha só", async () => {
    const c: CenarioDeConversa = {
      ...base("casa-sozinha"),
      mensagem: { texto: "comprei abóbora, couve e arroz", atalhos: [] },
      interpretacao: {
        intencoes: ["casa"],
        estados: [],
        itens_casa: [
          { nome: "abóbora", acao: "tem" },
          { nome: "couve", acao: "tem" },
          { nome: "arroz", acao: "tem" },
        ],
        evitar_sempre: [],
        nao_come: [],
        gosta: [],
        restricoes: [],
        suspeito: false,
      },
    }

    const { rodada } = await abrir(c)

    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(rodada.final.saida?.propostas.map((p) => p.texto)).toEqual([
      "Você tem abóbora, couve e arroz branco em casa",
    ])
  })

  it("os textos de cada tipo saem como o modelo de cada um", async () => {
    const { rodada } = await abrir(OITO_TIPOS)

    expect(rodada.final.saida?.propostas.map((p) => p.texto)).toEqual([
      "Não sugerir mais frutos do mar (Evitar sempre)",
      "Sua alimentação é vegana",
      "Você não come leite",
      "Você gosta de canela",
      "Você tem abóbora em casa",
      "Acabou: couve",
    ])
  })

  it("os textos de lista e rotina, sozinhos no bloco", async () => {
    const c: CenarioDeConversa = {
      ...base("faltou-hoje"),
      interpretacao: { ...interpretacaoDe(base("faltou-hoje")), fato_de_rotina: FATO },
      roteiro: comRotina(base("faltou-hoje")),
    }

    const { rodada } = await abrir(c)

    expect(rodada.final.saida?.propostas.map((p) => p.texto)).toEqual([
      'Gengibre na lista "Para ter em casa" (faltou para chá de gengibre)',
      "Essa semana você vai almoçar fora todo dia",
    ])
  })
})

describe("bloco: ordem e teto", () => {
  it("a ordem é evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina", async () => {
    const { contaId, deps, runId } = await abrir(OITO_TIPOS)

    const tipos = await tiposDoBloco(deps, contaId, runId)

    expect(tipos).toEqual(ORDEM_DO_BLOCO.slice(0, 6))
  })

  it("teto de 6: 8 anotações criam 6 propostas; lista e rotina não existem no run", async () => {
    const { contaId, deps, runId, rodada } = await abrir(OITO_TIPOS)

    // Controle: o agente de fato propôs lista e rotina (são etapas de tool do run), só o bloco as corta.
    const etapas = await deps.stores.runs.etapas(contaId, runId)
    expect(etapas.filter((e) => e.tipo === "tool").map((e) => e.nome)).toEqual(
      expect.arrayContaining(["lista.propor", "memoria.propor"]),
    )
    expect(rodada.final.saida?.propostas).toHaveLength(6)
    const doRun = await deps.stores.proposals.doRun(contaId, runId)
    expect(doRun).toHaveLength(6)
    expect(doRun.some((p) => p.tool === "lista.propor")).toBe(false)
    expect(await tiposDoBloco(deps, contaId, runId)).not.toContain("memoria.propor:rotina")
  })
})

describe("bloco: nada duplicado", () => {
  it("evitar sempre já no perfil não gera linha; sem o perfil, gera", async () => {
    const b = base("evitar-sozinho")
    const semPerfil = await abrir(b)
    const comPerfil = await abrir({
      ...b,
      perfil: { ...b.perfil, evitar_sempre: [{ tipo: "grupo", valor: "frutos_do_mar" }] },
    })

    expect(semPerfil.rodada.final.saida?.propostas).toHaveLength(1)
    expect(comPerfil.rodada.final.status).toBe("done")
    expect(comPerfil.rodada.final.saida?.propostas).toEqual([])
  })

  it("restrição já no perfil não gera linha; sem o perfil, gera", async () => {
    const b = base("vegetariana")
    const semPerfil = await abrir(b)
    const comPerfil = await abrir({ ...b, perfil: { ...b.perfil, restricoes: ["vegetariana"] } })

    expect(semPerfil.rodada.final.saida?.propostas.map((p) => p.tool)).toEqual(["memoria.propor"])
    expect(comPerfil.rodada.final.saida?.propostas).toEqual([])
  })

  it("gosto já registrado não gera linha; sem o registro, gera", async () => {
    // Entrega sem sugestão: a validação recusaria as sugestões de frio, que este cenário não tem.
    const roteiro: CenarioDeConversa["roteiro"] = [
      {
        texto: "Vou responder com o que ouvi.",
        chamadas: [
          {
            nome: "finalizar",
            argumentos: {
              resposta: "Anotado. Se puder, sente-se para comer, sem tela.",
              sugestoes: [],
              incertos: ["Não sei o que há na sua casa."],
            },
          },
        ],
      },
    ]
    const c: CenarioDeConversa = {
      ...base("evitar-sozinho"),
      mensagem: { texto: "gosto de canela", atalhos: [] },
      interpretacao: {
        intencoes: ["momento"],
        estados: [],
        itens_casa: [],
        evitar_sempre: [],
        nao_come: [],
        gosta: ["canela"],
        restricoes: [],
        suspeito: false,
      },
      roteiro,
    }
    const semRegistro = await abrir(c)
    const comRegistro = await abrir({
      ...c,
      preferencias: [{ tipo: "alimento", id: "canela", gosto: "gosta" }],
    })

    expect(semRegistro.rodada.final.saida?.propostas.map((p) => p.texto)).toEqual([
      "Você gosta de canela",
    ])
    expect(comRegistro.rodada.final.saida?.propostas).toEqual([])
  })

  it("alimento já na lista não gera linha de lista; sem a lista, gera", async () => {
    const semLista = await abrir(base("faltou-hoje"))
    const comLista = await abrir(base("faltou-hoje"), async (deps, contaId) => {
      await deps.stores.shortages.porNaLista(contaId, {
        alimento_id: "gengibre",
        motivo: "faltou_hoje",
        detalhe: "o chá",
      })
    })

    expect(await tiposDoBloco(semLista.deps, semLista.contaId, semLista.runId)).toEqual([
      "lista.propor",
    ])
    expect(await tiposDoBloco(comLista.deps, comLista.contaId, comLista.runId)).toEqual([])
    expect(comLista.rodada.final.status).toBe("done")
  })

  it("fato igual a nota de rotina ativa não gera linha; sem a nota, gera", async () => {
    const b = base("aprovacao-parcial")
    const semNota = await abrir(b)
    const comNota = await abrir(b, async (deps, contaId) => {
      await deps.stores.routine.anotar(contaId, FATO)
    })

    expect(await tiposDoBloco(semNota.deps, semNota.contaId, semNota.runId)).toEqual([
      "casa.propor:tem",
      "memoria.propor:rotina",
    ])
    expect(await tiposDoBloco(comNota.deps, comNota.contaId, comNota.runId)).toEqual([
      "casa.propor:tem",
    ])
  })
})

describe("bloco: run sem nada a propor", () => {
  it("termina em done, sem linhas e sem bloco", async () => {
    // Controle: o cenário de origem tem para_ter (e daria linha); a entrada usada não tem.
    expect(temParaTer(base("so-atalhos"))).toBe(true)
    expect(temParaTer(semParaTer(base("so-atalhos")))).toBe(false)
    const { contaId, deps, runId, rodada } = await abrir(semParaTer(base("so-atalhos")))

    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida?.propostas).toEqual([])
    expect(await deps.stores.proposals.doRun(contaId, runId)).toEqual([])
  })
})

describe("bloco: caminhos de código com linhas", () => {
  it.each(["casa-sozinha", "evitar-sozinho"])(
    "%s termina em waiting_for_approval com linhas",
    async (nome) => {
      const { rodada } = await abrir(base(nome))

      expect(rodada.final.status).toBe("waiting_for_approval")
      expect(rodada.final.saida?.propostas.length).toBeGreaterThan(0)
    },
  )
})

describe("bloco: pergunta e depois propostas", () => {
  // Registra cada troca de status do run, pelos dois caminhos que o serviço usa.
  function gravarTrocas(deps: DepsDoCenario): string[] {
    const trocas: string[] = []
    const runs = deps.stores.runs
    const atualizar = runs.atualizar.bind(runs)
    const mudarSe = runs.mudarStatusSe.bind(runs)
    vi.spyOn(runs, "atualizar").mockImplementation(async (contaId, runId, campos) => {
      if (campos.status) trocas.push(campos.status)
      return atualizar(contaId, runId, campos)
    })
    vi.spyOn(runs, "mudarStatusSe").mockImplementation(async (contaId, runId, de, para) => {
      const ok = await mudarSe(contaId, runId, de, para)
      if (ok) trocas.push(para)
      return ok
    })
    return trocas
  }

  it("waiting_for_input → running → waiting_for_approval, com a pergunta respondida", async () => {
    const c = base("faltou-hoje")
    const { contaId, deps } = await montarCenario(c)
    const trocas = gravarTrocas(deps)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.perguntas).toHaveLength(1)
    expect(trocas).toEqual(["waiting_for_input", "running", "waiting_for_approval"])
    expect(rodada.final.status).toBe("waiting_for_approval")
  })
})

describe("bloco: a resposta fica no run e volta antes de aprovar", () => {
  it("saida do run e a mensagem do agente são a resposta devolvida, com sugestão", async () => {
    const { contaId, deps, runId, rodada } = await abrir(base("faltou-hoje"))

    const resposta = rodada.final.saida?.resposta ?? ""
    expect(resposta).not.toBe("")
    expect(rodada.final.saida?.sugestoes.length).toBeGreaterThan(0)

    const run = await deps.stores.runs.buscar(contaId, runId)
    expect(run?.status).toBe("waiting_for_approval")
    // A saída gravada no run é válida pelo contrato e é a mesma que o agente devolveu.
    const gravada = saidaDoAcompanhanteSchema.safeParse(run?.saida)
    expect(gravada.success).toBe(true)
    expect(gravada.success && gravada.data.resposta).toBe(resposta)
    expect(gravada.success && gravada.data.sugestoes.length).toBe(
      rodada.final.saida?.sugestoes.length,
    )
    const mensagens = await deps.stores.messages.doDia(contaId, run?.dia ?? "")
    expect(mensagens.some((m) => m.autor === "agente" && m.texto === resposta)).toBe(true)
  })
})
