import { describe, expect, it } from "vitest"
import { saidaDoAcompanhanteSchema } from "@/core/agents/companion/saida"
import type { DepsDoCenario } from "../../../test/fixtures/cenarios"
import { cenariosDeAprendizado, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa, Toque } from "../../../test/fixtures/cenarios/tipos"

// Pergunta da troca: sem substituto confirmado, pergunta o incerto ou o nunca registrado; "acabou" não é perguntado;
// "Tenho" registra e troca; "Não tenho" grava a falta e encerra; uma pergunta por toque.

// Mel do chá do nao-tenho-com-pergunta, sem os toques dele: a primeira pergunta é o melado.
const PRIMEIRO_CANDIDATO = "melado"

function base(): CenarioDeConversa {
  const c = cenariosDeAprendizado["nao-tenho-com-pergunta"]
  if (!c) throw new Error("cenário ausente: nao-tenho-com-pergunta")
  return c
}

// O mel é trocado sem `Não tenho` (motivo trocar): a pergunta é só a leitura, não grava nada.
const trocarMel = (resposta?: "tenho" | "nao_tenho"): Toque => ({
  tipo: "troca",
  sugestao: 0,
  alimento_id: "mel",
  motivo: "trocar",
  ...(resposta ? { resposta } : {}),
})

async function montarDoMel(c: CenarioDeConversa) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, runId: rodada.final.run_id, rodada }
}

const metricas = (deps: DepsDoCenario, nome: string, rotulos: Record<string, string>) =>
  deps.telemetry.metricas.filter(
    (m) =>
      m.nome === nome &&
      Object.entries(rotulos).every(
        ([chave, valor]) => (m.rotulos as Record<string, unknown>)[chave] === valor,
      ),
  )

describe("sem substituto confirmado, a troca pergunta pelo candidato", () => {
  it("nunca registrado: pergunta 'Você tem …?' e não troca", async () => {
    const c: CenarioDeConversa = { ...base(), toques: undefined }
    const { contaId, deps, runId } = await montarDoMel(c)
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "mel",
      motivo: "trocar",
    })

    expect(resultado).toEqual({
      resultado: "perguntar",
      pergunta: {
        alimento_id: PRIMEIRO_CANDIDATO,
        nome: "Melado",
        texto: "Você tem melado em casa?",
      },
    })
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "perguntar" })).toEqual([])
  })

  it("incerto em casa: pergunta 'Ainda tem …?'", async () => {
    const c: CenarioDeConversa = {
      ...base(),
      toques: undefined,
      casa: [...base().casa, { alimento_id: PRIMEIRO_CANDIDATO, diasDesdeConfirmacao: 400 }],
    }
    const { contaId, deps, runId } = await montarDoMel(c)
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "mel",
      motivo: "trocar",
    })

    expect(resultado.resultado).toBe("perguntar")
    if (resultado.resultado !== "perguntar") throw new Error("sem pergunta")
    expect(resultado.pergunta.alimento_id).toBe(PRIMEIRO_CANDIDATO)
    expect(resultado.pergunta.texto).toBe("Ainda tem melado?")
  })

  it("acabou não é perguntado: o candidato marcado como acabou sai da pergunta", async () => {
    const c: CenarioDeConversa = { ...base(), toques: undefined }
    const { contaId, deps, runId } = await montarDoMel(c)
    await deps.stores.pantry.registrar(contaId, [{ alimento_id: PRIMEIRO_CANDIDATO }], "conversa")
    await deps.stores.pantry.marcarAcabou(contaId, [{ alimento_id: PRIMEIRO_CANDIDATO }])
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "mel",
      motivo: "trocar",
    })

    expect(resultado.resultado).not.toBe("trocou")
    if (resultado.resultado === "perguntar") {
      expect(resultado.pergunta.alimento_id).not.toBe(PRIMEIRO_CANDIDATO)
    }
  })
})

describe("'Tenho' registra o candidato e troca", () => {
  it("o candidato entra em casa como tem, e o item sai por ele no mesmo toque", async () => {
    const c: CenarioDeConversa = { ...base(), toques: [trocarMel("tenho")] }
    const { contaId, deps, rodada } = await montarDoMel(c)
    const [toque] = rodada.toques ?? []

    expect(toque).toMatchObject({ tipo: "troca", resultado: { resultado: "perguntar" } })
    expect(toque?.tipo === "troca" && toque.resposta).toMatchObject({ resultado: "trocou" })
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === PRIMEIRO_CANDIDATO)?.estado).toBe("tem")
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    const saida = saidaDoAcompanhanteSchema.parse(run?.saida)
    const item = saida.sugestoes[0]?.itens.find((i) => i.alimento_id === "mel")
    expect(item?.troca?.alimento_id).toBe(PRIMEIRO_CANDIDATO)
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "trocou" })).toHaveLength(1)
  })
})

describe("'Não tenho' grava a falta do candidato e encerra", () => {
  it("o candidato ganha falta nao_tenho, sem troca e sem nova pergunta no mesmo toque", async () => {
    const c: CenarioDeConversa = { ...base(), toques: [trocarMel("nao_tenho")] }
    const { contaId, deps, rodada } = await montarDoMel(c)
    const [toque] = rodada.toques ?? []

    expect(toque?.tipo === "troca" && toque.resposta).toEqual({
      resultado: "sem_substituto",
      texto: "Não achei uma troca para mel com o que você tem em casa.",
    })
    const faltas = await deps.stores.shortages.diasComFalta(contaId, "2026-01-01")
    expect(faltas.map((f) => f.alimento_id)).toContain(PRIMEIRO_CANDIDATO)
    expect(metricas(deps, "ritu_faltas_total", { origem: "nao_tenho" })).toHaveLength(1)
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "trocou" })).toHaveLength(0)
    expect(
      metricas(deps, "ritu_troca_ingrediente_total", { resultado: "sem_substituto" }),
    ).toHaveLength(1)
  })

  it("a pergunta em si não grava nada: sem resposta, nenhuma falta e nenhum candidato em casa", async () => {
    const c: CenarioDeConversa = { ...base(), toques: undefined }
    const { contaId, deps, runId } = await montarDoMel(c)
    await deps.touches.trocarIngrediente(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "mel",
      motivo: "trocar",
    })

    const faltas = await deps.stores.shortages.diasComFalta(contaId, "2026-01-01")
    expect(faltas.map((f) => f.alimento_id)).not.toContain(PRIMEIRO_CANDIDATO)
    expect(
      (await deps.stores.pantry.listar(contaId)).some((i) => i.alimento_id === PRIMEIRO_CANDIDATO),
    ).toBe(false)
    expect(metricas(deps, "ritu_faltas_total", { origem: "nao_tenho" })).toEqual([])
  })
})

describe("resposta a um candidato que não é o da pergunta", () => {
  it("candidato inválido: responderTroca devolve sem_substituto, soma a métrica e não grava nada", async () => {
    const c: CenarioDeConversa = { ...base(), toques: undefined }
    const { contaId, deps, runId } = await montarDoMel(c)
    const resposta = await deps.touches.responderTroca(contaId, {
      runId,
      sugestao: 0,
      alimento_id: "mel",
      candidato: "inexistente",
      resposta: "tenho",
    })

    expect(resposta).toEqual({
      resultado: "sem_substituto",
      texto: "Não achei uma troca para mel com o que você tem em casa.",
    })
    expect(
      metricas(deps, "ritu_troca_ingrediente_total", { resultado: "sem_substituto" }),
    ).toHaveLength(1)
    expect(metricas(deps, "ritu_troca_ingrediente_total", { resultado: "trocou" })).toEqual([])
    expect(
      (await deps.stores.pantry.listar(contaId)).some((i) => i.alimento_id === "inexistente"),
    ).toBe(false)
  })
})
