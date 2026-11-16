import { describe, expect, it } from "vitest"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import {
  cenariosComAprovacao,
  cenariosDeGuardrails,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import { RESPOSTA_DA_NOTA } from "../../../test/fixtures/cenarios/nota-com-saude"
import type {
  Cenario as CenarioBase,
  CenarioDeConversa,
} from "../../../test/fixtures/cenarios/tipos"

// Nota com saúde (013, T16): a linha de rotina sai do bloco, as outras propostas ficam,
// e sem nota no run o apontamento de saúde é ignorado.

const FATO = "você toma remédio para pressão toda manhã"
const TRECHO = "remédio para pressão"

function pegar<T>(registro: Record<string, T>, nome: string): T {
  const c = registro[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

function exigir<T>(valor: T | undefined, nome: string): T {
  if (valor === undefined) throw new Error(`cenário ${nome} sem campo obrigatório`)
  return valor
}

const notaComSaude = pegar(cenariosDeGuardrails, "nota-com-saude")
const faltou = pegar(cenariosComAprovacao, "faltou-hoje")

const apontaSaude = [{ apontamentos: [{ motivo: "saude_na_proposta", trecho: TRECHO }] }]

// Os passos do agente (lista e finalizar) mais a proposta de rotina antes da entrega.
const propostaDeRotina: PassoRoteirizado = {
  texto: "Vou propor guardar a rotina, se a pessoa quiser.",
  chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
}

// Faltou-hoje com a rotina dita (fato_de_rotina) e a saúde apontada na proposta de rotina.
const comRotinaEListaFaltou: CenarioDeConversa = {
  ...faltou,
  interpretacao: { ...exigir(faltou.interpretacao, faltou.nome), fato_de_rotina: FATO },
  juiz: apontaSaude,
  roteiro: [
    ...faltou.roteiro.slice(0, -1),
    propostaDeRotina,
    exigir(faltou.roteiro.at(-1), faltou.nome),
  ],
}

// Sem nota no run: o agente só responde, a rotina não é proposta; o Juiz aponta saúde assim mesmo.
const semNota: CenarioDeConversa = {
  ...notaComSaude,
  juiz: apontaSaude,
  roteiro: notaComSaude.roteiro.slice(1),
}

async function rodar(c: CenarioBase) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, rodada }
}

const ferramentas = (lista: { tool: string }[] | undefined) => (lista ?? []).map((p) => p.tool)

// Avisos do Juiz por saúde na proposta (contados só quando o motivo passa pelo filtro de registros).
function avisosDeSaude(deps: DepsDoCenario): number {
  return deps.telemetry.metricas
    .filter((m) => m.nome === "ritu_juiz_avisos_total" && m.rotulos.motivo === "saude_na_proposta")
    .reduce((soma, m) => soma + m.valor, 0)
}

describe("a linha de rotina sai do bloco", () => {
  it("a proposta de rotina marcada pelo Juiz não chega à saída", async () => {
    const { rodada } = await rodar(notaComSaude)
    const final = rodada.final

    // Sem proposta restante, o run fecha como done e o bloco não abre.
    expect(final.status).toBe("done")
    expect(ferramentas(final.saida?.propostas)).not.toContain("memoria.propor")
  })

  it("o Juiz registra o apontamento de saúde como registro, com o código no resumo da etapa", async () => {
    const { contaId, deps, rodada } = await rodar(notaComSaude)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    const juiz = etapas.find((e) => e.tipo === "juiz")

    expect(juiz?.resumo).toBe("aprovado; registros: saude_na_proposta")
    expect(avisosDeSaude(deps)).toBe(1)
  })
})

describe("as outras propostas ficam", () => {
  it("com a rotina e a lista do faltou-hoje, só a rotina sai; a lista segue no bloco", async () => {
    const { rodada } = await rodar(comRotinaEListaFaltou)

    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(ferramentas(rodada.final.saida?.propostas)).toEqual(["lista.propor"])
    expect(ferramentas(rodada.bloco?.propostas)).toEqual(["lista.propor"])
  })
})

describe("sem nota no run, saude_na_proposta é ignorado", () => {
  it("o Juiz aprova sem registro, sem aviso e a resposta sai como foi escrita", async () => {
    const { contaId, deps, rodada } = await rodar(semNota)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    const juiz = etapas.find((e) => e.tipo === "juiz")

    expect(juiz?.resumo).toBe("aprovado")
    expect(avisosDeSaude(deps)).toBe(0)
    expect(rodada.final.saida?.resposta).toBe(RESPOSTA_DA_NOTA)
    expect(rodada.final.status).toBe("done")
  })
})
