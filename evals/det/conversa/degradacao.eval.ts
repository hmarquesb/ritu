import { describe, expect, it } from "vitest"
import type { Estado } from "@/core/knowledge/vocab"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

const TEXTO = "estou com frio"
// 16h em São Paulo: há práticas "pratica" para o frio nessa faixa (as de chá são de outro tipo e não entram sem modelo).
const TARDE = "2026-06-15T19:00:00.000Z"

function base(atalhos: Estado[]): CenarioDeConversa {
  return {
    ...com(cenario("so-atalhos"), TEXTO, { intencoes: ["momento"], estados: ["com_frio"] }),
    agora: TARDE,
    mensagem: { texto: TEXTO, atalhos },
  }
}

// Mensagem com texto e atalhos, em que o papel do Intérprete (apoio) está esgotado no dia.
function semModelo(atalhos: Estado[]): CenarioDeConversa {
  return { ...base(atalhos), esgotado: "apoio" }
}

// Mensagem com texto e atalhos, em que o Intérprete responde com erro.
function comErro(atalhos: Estado[]): CenarioDeConversa {
  return base(atalhos)
}

async function rodar(c: CenarioDeConversa, respostas: unknown[]) {
  const llm = createFakeLlm(respostas)
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const fallback = deps.telemetry.metricas.filter((m) => m.nome === "ritu_fallback_sem_llm_total")
  return { resposta, run, etapas, runtime, fallback, llm }
}

const CASOS: [string, Estado[]][] = [
  ["com atalhos", ["com_frio"]],
  ["sem atalhos", []],
]

describe.each([
  ["Intérprete sem modelo (papel apoio esgotado)", (atalhos: Estado[]) => semModelo(atalhos), []],
  [
    "Intérprete com erro (indisponível)",
    (atalhos: Estado[]) => comErro(atalhos),
    [{ erro: "indisponivel" }],
  ],
] as const)("%s", (_, montar, respostas) => {
  it.each(CASOS)("%s: o run cai em sem_modelo, sem chamar o runtime", async (_nome, atalhos) => {
    const { run, runtime, resposta } = await rodar(montar(atalhos), [...respostas])

    expect(run?.caminho).toBe("sem_modelo")
    expect(resposta.saida.origem).toBe("sem_modelo")
    expect(resposta.saida.resposta.length).toBeGreaterThan(0)
    expect(runtime.pedidos).toHaveLength(0)
  })

  it.each(CASOS)("%s: a etapa do Intérprete fica como falha", async (_nome, atalhos) => {
    const { etapas } = await rodar(montar(atalhos), [...respostas])
    const interprete = etapas.find((e) => e.tipo === "interprete")

    expect(interprete?.status).toBe("falhou")
  })

  it.each(CASOS)("%s: ritu_fallback_sem_llm_total soma 1", async (_nome, atalhos) => {
    const { fallback } = await rodar(montar(atalhos), [...respostas])

    expect(fallback).toHaveLength(1)
  })

  it("com atalhos, a resposta sem modelo traz práticas; sem atalhos, não traz", async () => {
    const com = await rodar(montar(["com_frio"]), [...respostas])
    const sem = await rodar(montar([]), [...respostas])

    expect(com.resposta.saida.sugestoes.some((s) => s.tipo === "pratica")).toBe(true)
    expect(sem.resposta.saida.sugestoes.some((s) => s.tipo === "pratica")).toBe(false)
  })
})
