import { describe, expect, it } from "vitest"
import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import { RituError } from "@/core/errors"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import {
  cenariosComAprovacao,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// D15: "zero escrita" compara as quatro tabelas (perfil, casa, rotina e lista) entre o momento em que o bloco abre
// e o estado depois de não aprovar, expirar ou mandar mensagem nova. Nos cenários sem pergunta, compara também com o
// estado de antes da mensagem.

// Mensagem que chega com o bloco aberto: caminho de ofensa, que não grava nada.
const MENSAGEM_NOVA = { texto: "você é inútil", atalhos: [] }
const OFENSA: SaidaDoInterprete = {
  intencoes: ["ofensa"],
  estados: [],
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

// Sem pergunta de casa no caminho: o estado de antes da mensagem vale também.
const SEM_PERGUNTA = ["aprovacao-parcial", "vegetariana", "casa-sozinha"]
// Com pergunta de casa: "Não tenho" grava em Minha casa antes do bloco, então só vale o momento de abrir.
const TODOS = [...SEM_PERGUNTA, "faltou-hoje"]

const MINUTOS_DA_ESPERA = 31

function cenarioDeAprovacao(nome: string): CenarioDeConversa {
  const c = cenariosComAprovacao[nome] ?? cenariosDeConversa[nome]
  if (!c) throw new Error(`cenário de aprovação ausente: ${nome}`)
  return c
}

async function fotografar(deps: DepsDoCenario, contaId: string) {
  return {
    perfil: await deps.stores.profiles.ler(contaId),
    casa: await deps.stores.pantry.listar(contaId),
    rotina: await deps.stores.routine.notasAtivas(contaId),
    lista: await deps.stores.shortages.lista(contaId),
  }
}

// Roda o cenário até o run esperar a aprovação, sem decidir o bloco e sem a segunda mensagem.
async function abrirBloco(nome: string) {
  const base = cenarioDeAprovacao(nome)
  const c: CenarioDeConversa = { ...base, aprovacao: undefined, depois: undefined }
  // A aprovação do Juiz (mesmo cliente) vem logo depois da primeira interpretação.
  const sinais = [c.interpretacao, { apontamentos: [] }, OFENSA].filter((i) => i !== undefined)
  const { contaId, deps } = await montarCenario(c, { llm: createFakeLlm(sinais) })
  const antes = await fotografar(deps, contaId)
  const rodada = await rodarCenario(deps, contaId, c)
  const aberto = await fotografar(deps, contaId)
  const ids = rodada.final.saida?.propostas.map((p) => p.id) ?? []
  return { contaId, deps, rodada, antes, aberto, ids }
}

describe("zero escrita: o bloco abre sem gravar", () => {
  it.each(TODOS)("%s: o bloco abre aguardando a aprovação", async (nome) => {
    const { rodada, ids } = await abrirBloco(nome)

    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(ids.length).toBeGreaterThan(0)
  })
})

describe("zero escrita: Agora não", () => {
  it.each(TODOS)(
    "%s: não aprovar nada mantém o estado do momento em que o bloco abriu",
    async (nome) => {
      const { contaId, deps, rodada, aberto } = await abrirBloco(nome)

      await deps.conversation.aprovar(contaId, rodada.final.run_id, [])

      expect(await fotografar(deps, contaId)).toEqual(aberto)
    },
  )

  it.each(SEM_PERGUNTA)("%s: Agora não volta ao estado de antes da mensagem", async (nome) => {
    const { contaId, deps, rodada, antes } = await abrirBloco(nome)

    await deps.conversation.aprovar(contaId, rodada.final.run_id, [])

    expect(await fotografar(deps, contaId)).toEqual(antes)
  })
})

describe("zero escrita: expiração", () => {
  it.each(TODOS)("%s: aprovar depois de 31 min expira o bloco sem gravar", async (nome) => {
    const { contaId, deps, rodada, ids, aberto } = await abrirBloco(nome)

    deps.clock.advance(MINUTOS_DA_ESPERA * 60_000)
    await expect(
      deps.conversation.aprovar(contaId, rodada.final.run_id, ids),
    ).rejects.toMatchObject({ code: "aprovacao_expirada" })

    expect(await fotografar(deps, contaId)).toEqual(aberto)
  })

  it.each(SEM_PERGUNTA)("%s: expirado, o estado volta ao de antes da mensagem", async (nome) => {
    const { contaId, deps, rodada, ids, antes } = await abrirBloco(nome)

    deps.clock.advance(MINUTOS_DA_ESPERA * 60_000)
    await expect(
      deps.conversation.aprovar(contaId, rodada.final.run_id, ids),
    ).rejects.toBeInstanceOf(RituError)

    expect(await fotografar(deps, contaId)).toEqual(antes)
  })
})

describe("zero escrita: mensagem nova com o bloco aberto", () => {
  it.each(TODOS)("%s: a mensagem nova fecha o bloco sem gravar", async (nome) => {
    const { contaId, deps, rodada, aberto } = await abrirBloco(nome)

    await deps.conversation.conversar(contaId, MENSAGEM_NOVA)

    // iniciarRun fecha o run aguardando como done e expira as propostas dele (D10).
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    expect(run?.status).toBe("done")
    const propostas = await deps.stores.proposals.doRun(contaId, rodada.final.run_id)
    expect(propostas.every((p) => p.decisao === "expirada")).toBe(true)
    expect(await fotografar(deps, contaId)).toEqual(aberto)
  })
})
