import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { filtroVazio } from "@/core/knowledge/filtros"
import { padraoParaOBloco } from "@/core/patterns/bloco"
import type { Anotacao } from "@/core/proposals/anotacao"
import type { ConteudoDaProposta } from "@/core/proposals/conteudo"
import { montarPropostas } from "@/core/proposals/montar"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { alertaEmocional } from "../../../test/fixtures/cenarios/alerta-emocional"
import { casaSozinha } from "../../../test/fixtures/cenarios/casa-sozinha"
import { dorDeCabeca } from "../../../test/fixtures/cenarios/dor-de-cabeca"
import { evitarSozinho } from "../../../test/fixtures/cenarios/evitar-sozinho"
import { historicoDoCha } from "../../../test/fixtures/cenarios/padrao-confirmado"
import { padraoRecusado } from "../../../test/fixtures/cenarios/padrao-recusado"
import { retornoConversa } from "../../../test/fixtures/cenarios/retorno-conversa"
import { semModelo } from "../../../test/fixtures/cenarios/sem-modelo"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// A linha do padrão no bloco "Posso anotar isto?": uma por resposta, por último; adia com o bloco cheio; só no
// caminho do acompanhante, com resposta do agente e sem incômodo; uma vez por dia; some depois de três vezes sem resposta.

const kb = getContainer().knowledge
const AGORA = "2026-11-15T18:00:00.000Z"
const DIA_MS = 86_400_000
const CHA = "cha-gengibre-canela"
const CHAVE = `com_frio+agitada|pratica:${CHA}`
const FRASE = "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar."

// Cenário com o histórico do chá (o padrão candidato) e o bloco aberto, para olhar as linhas.
function comHistoricoAberto(c: Cenario): Cenario {
  return {
    ...c,
    historico: historicoDoCha,
    detectar: true,
    aprovacao: undefined,
    depois: undefined,
  }
}

function tiposDoBloco(propostas: { tool: string }[]): string[] {
  return propostas.map((p) => p.tool)
}

function temPadrao(propostas: { tool: string }[]): boolean {
  return propostas.some((p) => p.tool === "padrao.confirmar")
}

describe("padrão no bloco: uma linha por resposta, por último", () => {
  it("com o padrão candidato, a resposta do agente traz uma linha padrao.confirmar, depois das outras", async () => {
    const { contaId, deps } = await montarCenario(comHistoricoAberto(padraoRecusado))
    const rodada = await rodarCenario(deps, contaId, comHistoricoAberto(padraoRecusado))

    const propostas = rodada.final.saida?.propostas ?? []
    expect(tiposDoBloco(propostas)).toEqual(["casa.propor", "padrao.confirmar"])
    expect(propostas.filter((p) => p.tool === "padrao.confirmar")).toHaveLength(1)
  })

  it("na ordem do bloco, o padrão fica por último mesmo com outra linha antes dele", () => {
    const anotacoes: Anotacao[] = [{ tipo: "casa_tem", itens: [{ nome: "abóbora" }] }]
    const padrao: ConteudoDaProposta = { tool: "padrao.confirmar", padrao_id: "p1", frase: FRASE }

    const linhas = montarPropostas({ anotacoes, doAgente: [], extras: [padrao] })

    expect(linhas.map((c) => c.tool)).toEqual(["casa.propor", "padrao.confirmar"])
  })
})

describe("padrão no bloco: bloco cheio adia", () => {
  it("com seis linhas antes, o padrão sai do bloco e segue candidato; no bloco seguinte, com espaço, entra", async () => {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock)
    const deps = { stores, kb, clock }
    const conta = "c1"
    await stores.patterns.propor(conta, {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    const anotacoes: Anotacao[] = [
      { tipo: "casa_tem", itens: [{ nome: "abóbora" }] },
      { tipo: "casa_acabou", itens: [{ nome: "couve" }] },
      { tipo: "nao_come", itens: [{ nome: "leite" }] },
      { tipo: "gosta", itens: [{ alimento_id: "canela", nome: "canela" }] },
      { tipo: "evitar_sempre", itens: [{ tipo: "texto", valor: "camarão" }] },
    ]
    const lista: ConteudoDaProposta = {
      tool: "lista.propor",
      alimento_id: "abobora",
      motivo: "fez_falta",
      detalhe: "2",
    }

    const padraoCheio = await padraoParaOBloco({ stores, kb, clock }, conta, {
      filtro: filtroVazio,
    })
    const cheio = montarPropostas({ anotacoes, doAgente: [lista], extras: padraoCheio })
    expect(cheio).toHaveLength(config.aprovacao.maxLinhas)
    expect(cheio.some((c) => c.tool === "padrao.confirmar")).toBe(false)
    expect(await stores.patterns.listar(conta, "candidato")).toHaveLength(1)

    const padraoDepois = await padraoParaOBloco(deps, conta, { filtro: filtroVazio })
    const seguinte = montarPropostas({ anotacoes: [], doAgente: [], extras: padraoDepois })
    expect(seguinte.map((c) => c.tool)).toEqual(["padrao.confirmar"])
  })
})

describe("padrão no bloco: só no caminho do acompanhante, com resposta do agente e sem incômodo", () => {
  it("caminho alerta: o padrão não entra no bloco e segue candidato", async () => {
    const c = comHistoricoAberto(alertaEmocional)
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)

    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    expect(run?.caminho).toBe("alerta")
    expect(temPadrao(rodada.final.saida?.propostas ?? [])).toBe(false)
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })

  it("resposta com incômodo: o padrão não entra no bloco e segue candidato", async () => {
    const c = comHistoricoAberto(dorDeCabeca)
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)

    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    expect(run?.com_incomodo).toBe(true)
    expect(temPadrao(rodada.final.saida?.propostas ?? [])).toBe(false)
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })

  it("resposta montada por código (sem modelo): o padrão não entra no bloco", async () => {
    const c = comHistoricoAberto(semModelo)
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.final.saida?.origem).toBe("sem_modelo")
    expect(temPadrao(rodada.final.saida?.propostas ?? [])).toBe(false)
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })
})

describe("padrão no bloco: outros caminhos e origens ficam de fora", () => {
  it.each([
    ["casa-sozinha", casaSozinha, "casa"],
    ["evitar-sozinho", evitarSozinho, "evitar"],
    ["retorno-conversa", retornoConversa, "retorno"],
  ] as const)(
    "caminho %s (%s): o padrão não entra no bloco e segue candidato",
    async (_nome, base, caminho) => {
      const c = comHistoricoAberto(base)
      const { contaId, deps } = await montarCenario(c)
      const rodada = await rodarCenario(deps, contaId, c)

      const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
      expect(run?.caminho).toBe(caminho)
      expect(temPadrao(rodada.final.saida?.propostas ?? [])).toBe(false)
      expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
    },
  )

  it("resposta sem modelo na conversa (decisão esgotada): o padrão não entra no bloco", async () => {
    const c = { ...comHistoricoAberto(padraoRecusado), esgotado: "decisao" as const }
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.final.saida?.origem).toBe("sem_modelo")
    expect(temPadrao(rodada.final.saida?.propostas ?? [])).toBe(false)
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })
})

describe("padrão no bloco: uma vez por dia, e some depois de três vezes sem resposta", () => {
  // Proposta do padrão criada num run do dia, sem resposta.
  async function propor(
    stores: ReturnType<typeof createMemoryStores>,
    conta: string,
    padraoId: string,
  ) {
    const run = await stores.runs.criar(conta, {
      caminho: "acompanhante",
      intencoes: [],
      dia: "2026-11-15",
    })
    await stores.runs.atualizar(conta, run.id, { status: "done" })
    await stores.proposals.criar(conta, run.id, [
      { tool: "padrao.confirmar", conteudo: { padrao_id: padraoId, frase: FRASE } },
    ])
  }

  it("com a proposta de hoje, o padrão não volta no mesmo dia; no dia seguinte, volta", async () => {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock)
    const deps = { stores, kb, clock }
    const padrao = await stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("padrão não criado")
    await propor(stores, "c1", padrao.id)

    expect(await padraoParaOBloco(deps, "c1", { filtro: filtroVazio })).toEqual([])
    clock.set("2026-11-16T18:00:00.000Z")
    expect(await padraoParaOBloco(deps, "c1", { filtro: filtroVazio })).toHaveLength(1)
  })

  it("três propostas seguidas sem resposta tiram o padrão do bloco, e ele segue candidato", async () => {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock)
    const deps = { stores, kb, clock }
    const padrao = await stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("padrão não criado")

    for (let dia = 0; dia < config.padroes.bloco.vezesSemResposta; dia++) {
      clock.set(new Date(Date.parse(AGORA) + dia * DIA_MS).toISOString())
      expect(await padraoParaOBloco(deps, "c1", { filtro: filtroVazio })).toHaveLength(1)
      await propor(stores, "c1", padrao.id)
    }

    clock.set(
      new Date(Date.parse(AGORA) + config.padroes.bloco.vezesSemResposta * DIA_MS).toISOString(),
    )
    expect(await padraoParaOBloco(deps, "c1", { filtro: filtroVazio })).toEqual([])
    expect(await stores.patterns.listar("c1", "candidato")).toHaveLength(1)
  })

  it("com duas propostas sem resposta, o padrão ainda aparece", async () => {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock)
    const deps = { stores, kb, clock }
    const padrao = await stores.patterns.propor("c1", {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("padrão não criado")
    for (let dia = 0; dia < config.padroes.bloco.vezesSemResposta - 1; dia++) {
      clock.set(new Date(Date.parse(AGORA) + dia * DIA_MS).toISOString())
      await propor(stores, "c1", padrao.id)
    }

    clock.set(new Date(Date.parse(AGORA) + 2 * DIA_MS).toISOString())
    expect(await padraoParaOBloco(deps, "c1", { filtro: filtroVazio })).toHaveLength(1)
  })
})
