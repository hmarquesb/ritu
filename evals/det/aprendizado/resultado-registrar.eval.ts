import { describe, expect, it } from "vitest"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import {
  cenariosDeAprendizado,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// resultado.registrar: a tool liga o resultado da mensagem ao pendente certo; cada recusa tem o seu código;
// o resultado gravado é sempre o do Intérprete, nunca o que vem na chamada.

const ARROZ = { tipo: "preparo", id: "arroz-com-legume" } as const
const TITULO_ARROZ = "Arroz bem cozido com abóbora e ghee"

function retornoPeloAgente(): CenarioDeConversa {
  const c = cenariosDeAprendizado["retorno-pelo-agente"]
  if (!c) throw new Error("cenário retorno-pelo-agente ausente")
  return c
}

// Uma chamada de resultado.registrar por argumento, na ordem dada; o resto do roteiro (finalizar) segue igual.
function comRegistros(
  argumentos: Record<string, unknown>[],
  base: CenarioDeConversa = retornoPeloAgente(),
): CenarioDeConversa {
  const registros: PassoRoteirizado[] = argumentos.map((argumento) => ({
    texto: "Vou anotar como foi a sugestão de antes.",
    chamadas: [{ nome: "resultado.registrar", argumentos: argumento }],
  }))
  return { ...base, roteiro: [...registros, ...base.roteiro.slice(1)] }
}

// A mensagem sem retorno: o Intérprete não liga nada a um pendente, então o run não tem retorno.
function semRetornoNaMensagem(): CenarioDeConversa {
  const base = retornoPeloAgente()
  if (!base.interpretacao) throw new Error("retorno-pelo-agente sem interpretação")
  const { retorno: _retorno, ...interpretacao } = base.interpretacao
  return { ...base, interpretacao }
}

async function rodar(c: CenarioDeConversa) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, rodada }
}

// Os resumos das chamadas de resultado.registrar do run, na ordem: "registrado" ou "recusado: <código>".
async function resumosDaTool(deps: DepsDoCenario, contaId: string, runId: string) {
  const etapas = await deps.stores.runs.etapas(contaId, runId)
  return etapas.filter((e) => e.nome === "resultado.registrar").map((e) => e.resumo)
}

async function ajudouDoArroz(deps: DepsDoCenario, contaId: string) {
  const [pref] = await deps.stores.preferences.ler(contaId, [ARROZ])
  return { ajudou: pref?.ajudou ?? 0, nao_ajudou: pref?.nao_ajudou ?? 0 }
}

const titulosPendentes = async (deps: DepsDoCenario, contaId: string) =>
  (await deps.stores.outcomes.pendentes(contaId)).map((p) => p.sugestao.titulo)

const metricasDeRetorno = (deps: DepsDoCenario) =>
  deps.telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")

describe("resultado.registrar aceita e grava o resultado do Intérprete", () => {
  it("o pendente 1 fecha com ajudou, origem conversa, e sai dos pendentes", async () => {
    const { contaId, deps, rodada } = await rodar(comRegistros([{ pendente: 1 }]))

    expect(await resumosDaTool(deps, contaId, rodada.final.run_id)).toEqual(["registrado"])
    expect(await ajudouDoArroz(deps, contaId)).toEqual({ ajudou: 1, nao_ajudou: 0 })
    expect(await titulosPendentes(deps, contaId)).not.toContain(TITULO_ARROZ)
    expect(metricasDeRetorno(deps).map((m) => m.rotulos)).toEqual([
      { resultado: "ajudou", origem: "conversa" },
    ])
  })

  it("o resultado vem do Intérprete: um 'nao_ajudou' na chamada não muda o 'ajudou' da mensagem", async () => {
    const { contaId, deps } = await rodar(comRegistros([{ pendente: 1, resultado: "nao_ajudou" }]))

    expect(await ajudouDoArroz(deps, contaId)).toEqual({ ajudou: 1, nao_ajudou: 0 })
    expect(metricasDeRetorno(deps).map((m) => m.rotulos)).toEqual([
      { resultado: "ajudou", origem: "conversa" },
    ])
  })
})

describe("resultado.registrar recusa com o código do motivo", () => {
  it("sem_retorno quando o Intérprete não liga a mensagem a um retorno", async () => {
    const { contaId, deps, rodada } = await rodar(
      comRegistros([{ pendente: 1 }], semRetornoNaMensagem()),
    )

    expect(await resumosDaTool(deps, contaId, rodada.final.run_id)).toEqual([
      "recusado: sem_retorno",
    ])
    expect(await titulosPendentes(deps, contaId)).toContain(TITULO_ARROZ)
    expect(await ajudouDoArroz(deps, contaId)).toEqual({ ajudou: 0, nao_ajudou: 0 })
    expect(metricasDeRetorno(deps)).toEqual([])
  })

  it("ja_registrado quando a segunda chamada do run repete o mesmo pendente", async () => {
    const { contaId, deps, rodada } = await rodar(comRegistros([{ pendente: 1 }, { pendente: 1 }]))

    expect(await resumosDaTool(deps, contaId, rodada.final.run_id)).toEqual([
      "registrado",
      "recusado: ja_registrado",
    ])
    expect(await ajudouDoArroz(deps, contaId)).toEqual({ ajudou: 1, nao_ajudou: 0 })
    expect(metricasDeRetorno(deps)).toHaveLength(1)
  })

  it("fora_dos_pendentes quando o número não está nos pendentes do run", async () => {
    const { contaId, deps, rodada } = await rodar(comRegistros([{ pendente: 7 }]))

    expect(await resumosDaTool(deps, contaId, rodada.final.run_id)).toEqual([
      "recusado: fora_dos_pendentes",
    ])
    expect(await titulosPendentes(deps, contaId)).toContain(TITULO_ARROZ)
    expect(await ajudouDoArroz(deps, contaId)).toEqual({ ajudou: 0, nao_ajudou: 0 })
    expect(metricasDeRetorno(deps)).toEqual([])
  })
})
