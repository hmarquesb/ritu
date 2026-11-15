import { describe, expect, it } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import { normalizar } from "@/core/knowledge/identificar"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { type DepsDoCenario, montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com, conteudoDaPessoa } from "./apoio"

const kb = getContainer().knowledge
const FRUTOS_DO_MAR = { tipo: "grupo", valor: "frutos_do_mar" }
const DIA_DO_RUN = "2026-06-15"
const DIA_SEGUINTE = "2026-06-16T15:00:00.000Z"

async function montar(c: CenarioDeConversa) {
  const llm = createFakeLlm(c.interpretacao ? [c.interpretacao] : [])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  return { contaId, deps, runtime }
}

async function enviar(c: CenarioDeConversa) {
  const { contaId, deps, runtime } = await montar(c)
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  return { contaId, deps, runtime, resposta, run }
}

// O preparo que um run do mesmo dia faria: é ele que lê o temporário do dia.
function preparoDoDia(deps: DepsDoCenario, contaId: string) {
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    { intencoes: ["momento"], estados: ["com_frio"], evitar_da_mensagem: [] },
  )
}

// Ids de alimento que aparecem no contexto que o Acompanhante recebeu (candidatos e opções).
function idsNoContexto(conteudo: string): string[] {
  return [...conteudo.matchAll(/"alimento_id": "([^"]+)"/g)].map((m) => m[1] ?? "")
}

describe("evitar sozinho: o grupo fica no temporário do dia do run, sem ir ao perfil", () => {
  it("'não posso comer camarão' vira o grupo frutos do mar no temporário e não chama o runtime", async () => {
    const { contaId, deps, runtime, run } = await enviar(cenario("evitar-sozinho"))

    expect(run?.caminho).toBe("evitar")
    expect(runtime.pedidos).toHaveLength(0)
    expect(await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")).toContainEqual(
      FRUTOS_DO_MAR,
    )
  })

  it("o preparo do mesmo dia já filtra o grupo, e nenhum candidato traz frutos do mar", async () => {
    const { contaId, deps } = await enviar(cenario("evitar-sozinho"))
    const dados = await preparoDoDia(deps, contaId)

    expect(dados.filtro.evitar).toContainEqual(FRUTOS_DO_MAR)
    for (const c of dados.candidatos) {
      for (const item of c.itens) {
        expect(kb.alimento(item.alimento_id)?.grupos_evitar ?? []).not.toContain("frutos_do_mar")
      }
    }
  })

  it("não vai para evitar sempre do perfil", async () => {
    const { contaId, deps } = await enviar(cenario("evitar-sozinho"))
    const perfil = await deps.stores.profiles.ler(contaId)

    expect(perfil.evitar_sempre).toEqual([])
  })

  it("o item do temporário guarda só tipo e valor, sem motivo", async () => {
    const { contaId, deps, run } = await enviar(cenario("evitar-sozinho"))
    const temporario = await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")

    expect(temporario.length).toBeGreaterThan(0)
    for (const item of temporario) expect(Object.keys(item).sort()).toEqual(["tipo", "valor"])
  })
})

describe("evitar junto de momento: vai ao Acompanhante e o grupo filtra no mesmo run", () => {
  const c = com(cenario("so-atalhos"), "não posso comer camarão, estou com frio", {
    intencoes: ["evitar", "momento"],
    estados: ["com_frio"],
    evitar_sempre: ["camarão"],
  })

  it("o run segue ao Acompanhante e o grupo já está no temporário antes da resposta", async () => {
    const { contaId, deps, runtime, run } = await enviar(c)

    expect(run?.caminho).toBe("acompanhante")
    expect(runtime.pedidos.length).toBeGreaterThan(0)
    expect(await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")).toContainEqual(
      FRUTOS_DO_MAR,
    )
  })

  it("nenhum alimento do contexto que o Acompanhante recebeu traz frutos do mar", async () => {
    const { runtime } = await enviar(c)
    const ids = idsNoContexto(conteudoDaPessoa(runtime))

    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(kb.alimento(id)?.grupos_evitar ?? [], id).not.toContain("frutos_do_mar")
    }
  })
})

describe("o item de evitar fica até o fim do dia e some no dia seguinte", () => {
  it("o preparo do mesmo dia filtra; no dia seguinte, não", async () => {
    const { contaId, deps } = await enviar(cenario("evitar-sozinho"))

    expect((await preparoDoDia(deps, contaId)).filtro.evitar).toContainEqual(FRUTOS_DO_MAR)

    deps.clock.set(DIA_SEGUINTE)
    const depois = await preparoDoDia(deps, contaId)
    expect(depois.filtro.evitar).not.toContainEqual(FRUTOS_DO_MAR)
    expect(await deps.stores.profiles.evitarTemporario(contaId, DIA_DO_RUN)).toContainEqual(
      FRUTOS_DO_MAR,
    )
    expect(await deps.stores.profiles.evitarTemporario(contaId, "2026-06-16")).toEqual([])
  })
})

describe("alérgica: o motivo não aparece em nenhum registro do run", () => {
  it("run, etapas, mensagem do agente e anotações ficam sem o motivo", async () => {
    const c = com(cenario("evitar-sozinho"), "sou alérgica a camarão", {
      intencoes: ["evitar"],
      evitar_sempre: ["camarão"],
    })
    const { contaId, deps, run, resposta } = await enviar(c)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const doAgente = (await deps.stores.messages.doDia(contaId, run?.dia ?? "")).filter(
      (m) => m.autor === "agente",
    )

    expect(normalizar(JSON.stringify(run))).not.toContain("alergi")
    expect(normalizar(JSON.stringify(etapas))).not.toContain("alergi")
    expect(normalizar(JSON.stringify(resposta.saida?.anotacoes))).not.toContain("alergi")
    expect(normalizar(JSON.stringify(doAgente))).not.toContain("alergi")
  })
})

describe("restrição e 'não como': seguem o caminho evitar, filtram no dia e não vão ao perfil", () => {
  const vegetariana = com(cenario("evitar-sozinho"), "sou vegetariana", {
    intencoes: ["evitar"],
    restricoes: ["vegetariana"],
  })
  const coentro = com(cenario("evitar-sozinho"), "não como coentro", {
    intencoes: ["evitar"],
    nao_come: ["coentro"],
  })

  it("'sou vegetariana' vai ao temporário como restrição, sai como anotação e não vai ao perfil", async () => {
    const { contaId, deps, run, resposta } = await enviar(vegetariana)
    const perfil = await deps.stores.profiles.ler(contaId)

    expect(run?.caminho).toBe("evitar")
    expect(await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")).toContainEqual({
      tipo: "restricao",
      valor: "vegetariana",
    })
    expect(resposta.saida?.anotacoes).toContainEqual({
      tipo: "restricao",
      itens: ["vegetariana"],
    })
    expect(perfil.restricoes).toEqual([])
  })

  it("'sou vegetariana' filtra no preparo do mesmo dia e deixa de filtrar no dia seguinte", async () => {
    const { contaId, deps } = await enviar(vegetariana)

    expect((await preparoDoDia(deps, contaId)).filtro.restricoes).toContain("vegetariana")
    deps.clock.set(DIA_SEGUINTE)
    expect((await preparoDoDia(deps, contaId)).filtro.restricoes).not.toContain("vegetariana")
  })

  it("'não como coentro' vai ao temporário como 'não como' com id, sai como anotação e não vai ao perfil", async () => {
    const { contaId, deps, run, resposta } = await enviar(coentro)
    const perfil = await deps.stores.profiles.ler(contaId)
    const temporario = await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")
    const naoCome = temporario.find((item) => item.tipo === "nao_come")

    expect(run?.caminho).toBe("evitar")
    expect(naoCome).toBeDefined()
    expect(resposta.saida?.anotacoes.some((a) => a.tipo === "nao_come")).toBe(true)
    expect(perfil.nao_come).toEqual([])
  })

  it("'não como coentro' filtra no preparo do mesmo dia e deixa de filtrar no dia seguinte", async () => {
    const { contaId, deps, run } = await enviar(coentro)
    const temporario = await deps.stores.profiles.evitarTemporario(contaId, run?.dia ?? "")
    const id = temporario.find((item) => item.tipo === "nao_come")?.valor ?? ""

    expect((await preparoDoDia(deps, contaId)).filtro.nao_come).toContain(id)
    deps.clock.set(DIA_SEGUINTE)
    expect((await preparoDoDia(deps, contaId)).filtro.nao_come).not.toContain(id)
  })
})
