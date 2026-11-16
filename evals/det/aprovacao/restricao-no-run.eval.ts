import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { executarLimpeza } from "@/core/cleanup"
import { gravarResposta } from "@/core/runs/gravar-resposta"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { cenariosComAprovacao, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Restrição, "não como" e nome livre que a pessoa diz no run: o que o preparo filtra no dia, o que sobra no dia
// seguinte e o que vai ao perfil quando aprovado. "vegetariana" não barra alimento nenhum em data/ (só vegana,
// sem lactose e sem glúten), então o caso de restrição usa "vegana", que barra ghee e mel.
const kb = getContainer().knowledge
const AGORA = "2026-06-15T18:00:00.000Z"
const DIA = "2026-06-15"
const DIA_MS = 86_400_000
const VEGANA = "vegana" as const
// Aparece em vários candidatos de com_frio na base real (cha-canela, cha-gengibre-canela, fruta-cozida...).
const CANELA = "canela"

const alimentosDos = (d: DadosDoPreparo): string[] =>
  d.candidatos_do_preparo.flatMap((c) => c.alimentos)
const comVegana = (d: DadosDoPreparo): string[] =>
  alimentosDos(d).filter((id) => kb.alimento(id)?.restricoes.includes(VEGANA))

async function ambiente() {
  const clock = createFixedClock(AGORA)
  const stores = createMemoryStores(clock, { alimentoExiste: (id) => Boolean(kb.alimento(id)) })
  const telemetry = createMemoryTelemetry()
  const ledger = createMemoryLedger(clock)
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const contaId = conta.id
  const deps = { stores, kb, clock, telemetry }
  const ler = (e: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, contaId, {
      intencoes: ["momento"],
      estados: ["com_frio"],
      evitar_da_mensagem: [],
      ...e,
    })
  // Vira o dia e roda a limpeza diária, que apaga o temporário de ontem.
  const virarDia = async () => {
    clock.advance(DIA_MS)
    await executarLimpeza({ stores, clock, ledger, limiter: createMemoryLimiter() })
  }
  return { stores, clock, telemetry, ledger, contaId, deps, ler, virarDia }
}

describe("restrição da mensagem: o preparo não devolve o que ela barra", () => {
  it("controle: sem a restrição, algum candidato traz alimento que vegana barra", async () => {
    const a = await ambiente()
    expect(comVegana(await a.ler())).not.toEqual([])
  })

  it("com a restrição da mensagem, nenhum candidato traz alimento que ela barra", async () => {
    const a = await ambiente()

    const dados = await a.ler({ restricoes_da_mensagem: [VEGANA] })

    expect(dados.filtro.restricoes).toContain(VEGANA)
    expect(comVegana(dados)).toEqual([])
  })
})

describe("restrição da mensagem: fica no temporário do dia", () => {
  it("entra no temporário do dia", async () => {
    const a = await ambiente()

    await a.ler({ restricoes_da_mensagem: [VEGANA] })

    expect(await a.stores.profiles.evitarTemporario(a.contaId, DIA)).toContainEqual({
      tipo: "restricao",
      valor: VEGANA,
    })
  })

  it("a segunda mensagem do mesmo dia, sem aprovação, continua filtrando", async () => {
    const a = await ambiente()
    await a.ler({ restricoes_da_mensagem: [VEGANA] })

    expect(comVegana(await a.ler())).toEqual([])
  })

  it("no dia seguinte, depois da limpeza, deixa de filtrar", async () => {
    const a = await ambiente()
    await a.ler({ restricoes_da_mensagem: [VEGANA] })

    await a.virarDia()

    expect(comVegana(await a.ler())).not.toEqual([])
  })
})

describe("não como da mensagem, alimento da base: sai dos candidatos e vai ao temporário do dia", () => {
  it("controle: sem o não como, o preparo traz o alimento", async () => {
    const a = await ambiente()
    expect(alimentosDos(await a.ler())).toContain(CANELA)
  })

  it("com o não como, o alimento sai dos candidatos e entra no temporário do dia", async () => {
    const a = await ambiente()

    const dados = await a.ler({ nao_come_da_mensagem: [{ alimento_id: CANELA, nome: "canela" }] })

    expect(alimentosDos(dados)).not.toContain(CANELA)
    expect(await a.stores.profiles.evitarTemporario(a.contaId, DIA)).toContainEqual({
      tipo: "nao_come",
      valor: CANELA,
    })
  })

  it("a segunda mensagem do mesmo dia continua sem o alimento; no dia seguinte, volta", async () => {
    const a = await ambiente()
    await a.ler({ nao_come_da_mensagem: [{ alimento_id: CANELA, nome: "canela" }] })

    expect(alimentosDos(await a.ler())).not.toContain(CANELA)

    await a.virarDia()

    expect(alimentosDos(await a.ler())).toContain(CANELA)
  })
})

describe("não como da mensagem, nome livre: vai a evitar_textos e ao temporário do dia", () => {
  it("entra em evitar_textos e no temporário do dia", async () => {
    const a = await ambiente()

    const dados = await a.ler({ nao_come_da_mensagem: [{ nome: "jiló" }] })

    expect(dados.evitar_textos).toEqual(["jiló"])
    expect(await a.stores.profiles.evitarTemporario(a.contaId, DIA)).toContainEqual({
      tipo: "nao_come_texto",
      valor: "jiló",
    })
  })

  it("a segunda mensagem do mesmo dia ainda traz evitar_textos; no dia seguinte, não", async () => {
    const a = await ambiente()
    await a.ler({ nao_come_da_mensagem: [{ nome: "jiló" }] })

    expect((await a.ler()).evitar_textos).toEqual(["jiló"])

    await a.virarDia()

    expect((await a.ler()).evitar_textos).toEqual([])
  })
})

describe("não como respondido numa pergunta: entra no temporário do dia", () => {
  it("resposta 'não como' à pergunta de comer filtra o alimento no mesmo dia", async () => {
    const a = await ambiente()

    await gravarResposta(
      { tx: a.stores, telemetry: a.telemetry },
      a.contaId,
      "run-da-pergunta",
      DIA,
      { tipo: "come", texto: "Você come canela?", alimento_id: CANELA, nome: "canela" },
      { tipo: "come", resposta: "nao_como" },
    )

    expect(await a.stores.profiles.evitarTemporario(a.contaId, DIA)).toContainEqual({
      tipo: "nao_come",
      valor: CANELA,
    })
    expect(alimentosDos(await a.ler())).not.toContain(CANELA)
  })
})

// Bloco com a restrição e o não como da mensagem (o Intérprete devolve o não como como texto); a decisão é `aprovacao`.
function cenarioComRestricaoENaoCome(decisao: CenarioDeConversa["aprovacao"]): CenarioDeConversa {
  const base = cenariosComAprovacao["aprovacao-parcial"]
  if (!base?.interpretacao) throw new Error("cenário aprovacao-parcial ausente")
  return {
    ...base,
    interpretacao: {
      ...base.interpretacao,
      restricoes: [VEGANA],
      nao_come: [CANELA],
    },
    aprovacao: decisao,
    depois: undefined,
  }
}

describe("aprovadas no bloco: vão ao perfil e filtram no dia seguinte", () => {
  it("aprovadas, a restrição e o não como ficam no perfil e filtram no dia seguinte", async () => {
    // Linhas do bloco, na ordem: restrição (1), não como (2), casa (3), rotina (4).
    const c = cenarioComRestricaoENaoCome({ aprovar: [1, 2] })
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    expect((await deps.stores.profiles.ler(contaId)).restricoes).toEqual([VEGANA])
    expect((await deps.stores.profiles.ler(contaId)).nao_come).toEqual([
      { tipo: "alimento", valor: CANELA },
    ])

    deps.clock.advance(DIA_MS)
    await executarLimpeza({
      stores: deps.stores,
      clock: deps.clock,
      ledger: deps.ledger,
      limiter: createMemoryLimiter(),
    })
    const seguinte = await preparar(
      { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
      contaId,
      { intencoes: ["momento"], estados: ["com_frio"], evitar_da_mensagem: [] },
    )

    expect(comVegana(seguinte)).toEqual([])
    expect(alimentosDos(seguinte)).not.toContain(CANELA)
  })

  it("controle: com Agora não, nada vai ao perfil e o dia seguinte não filtra", async () => {
    const c = cenarioComRestricaoENaoCome("agora_nao")
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    expect((await deps.stores.profiles.ler(contaId)).restricoes).toEqual([])
    expect((await deps.stores.profiles.ler(contaId)).nao_come).toEqual([])

    deps.clock.advance(DIA_MS)
    await executarLimpeza({
      stores: deps.stores,
      clock: deps.clock,
      ledger: deps.ledger,
      limiter: createMemoryLimiter(),
    })
    const seguinte = await preparar(
      { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
      contaId,
      { intencoes: ["momento"], estados: ["com_frio"], evitar_da_mensagem: [] },
    )

    expect(comVegana(seguinte)).not.toEqual([])
    expect(alimentosDos(seguinte)).toContain(CANELA)
  })
})
