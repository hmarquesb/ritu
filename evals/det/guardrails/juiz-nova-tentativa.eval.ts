import { juiz } from "@config/juiz"
import { llmCotas } from "@config/llm-cotas"
import { loop } from "@config/loop"
import { describe, expect, it } from "vitest"
import { textosDoAcompanhante } from "@/core/agents/companion/textos"
import { createScriptedRuntime, type PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { cenariosDeGuardrails, montarCenario } from "../../../test/fixtures/cenarios"
import {
  entregaDoCha,
  passoDoClima,
  RESPOSTA_COM_PROMESSA,
  RESPOSTA_DE_CONFORTO,
} from "../../../test/fixtures/cenarios/juiz-corrige"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeGuardrails[nome]
  if (!c) throw new Error(`cenário de guardrail ausente: ${nome}`)
  return c
}

// Entrega com um id fora dos candidatos: a montagem recusa dentro da nova tentativa.
const entregaRecusada: PassoRoteirizado = {
  texto: "Vou montar a resposta com o chá.",
  chamadas: [
    {
      nome: "finalizar",
      argumentos: {
        resposta: "Um chá de hortelã morno ajuda a refrescar agora.",
        sugestoes: [
          {
            tipo: "cha",
            id: "cha-inexistente",
            motivo: "Refresca o corpo quando há calor.",
          },
        ],
        incertos: [],
      },
    },
  ],
}

const TRECHO_DE_REGISTRO = "TRECHO-DO-REGISTRO-JARGAO"

// Primeira entrega com promessa, e o Juiz também aponta jargao; a segunda leitura aprova.
const comPromessaEJargao: CenarioDeConversa = {
  ...cenario("juiz-corrige"),
  juiz: [
    {
      apontamentos: [
        { motivo: "promessa", trecho: "resolve a dor" },
        { motivo: "jargao", trecho: TRECHO_DE_REGISTRO },
      ],
    },
    { apontamentos: [] },
  ],
  roteiro: [
    passoDoClima,
    entregaDoCha(RESPOSTA_COM_PROMESSA),
    entregaRecusada,
    entregaDoCha(RESPOSTA_DE_CONFORTO),
  ],
}

function temMensagem(m: unknown, papel: string): boolean {
  return typeof m === "object" && m !== null && "papel" in m && m.papel === papel
}

// Mensagem de sistema que a nova tentativa manda ao modelo (não é gravada).
function mensagemDeSistema(pedidos: { mensagens: unknown[] }[]): string {
  for (const p of pedidos) {
    const m = p.mensagens.find((x) => temMensagem(x, "sistema"))
    if (m && typeof m === "object" && "conteudo" in m) return String(m.conteudo)
  }
  return ""
}

describe("nova tentativa: reprovação → sistema com os graves → reforco → aprovação", () => {
  it("a mensagem de sistema traz o grave e o trecho, e não traz o registro", async () => {
    const runtime = createScriptedRuntime(comPromessaEJargao.roteiro)
    const { contaId, deps } = await montarCenario(comPromessaEJargao, { runtime })
    await deps.conversation.conversar(contaId, comPromessaEJargao.mensagem)

    const sistema = mensagemDeSistema(runtime.pedidos)
    expect(sistema).toContain("Promete efeito de saúde")
    expect(sistema).toContain("resolve a dor")
    expect(sistema).not.toContain(TRECHO_DE_REGISTRO)
  })

  it("a nova tentativa roda no modelo do papel reforco, e o run registra o reforco", async () => {
    const runtime = createScriptedRuntime(comPromessaEJargao.roteiro)
    const { contaId, deps } = await montarCenario(comPromessaEJargao, { runtime })
    const resposta = await deps.conversation.conversar(contaId, comPromessaEJargao.mensagem)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    const pedidoDaNova = runtime.pedidos.find((p) =>
      p.mensagens.some((m) => temMensagem(m, "sistema")),
    )
    expect(pedidoDaNova?.modelo).toBe(llmCotas.papeis.reforco[0])
    expect(run?.modelos).toMatchObject({ reforco: [llmCotas.papeis.reforco[0]] })
  })

  it("a entrega refeita passa pelo validador: uma recusa no meio, e a correção é a que sai", async () => {
    const runtime = createScriptedRuntime(comPromessaEJargao.roteiro)
    const { contaId, deps } = await montarCenario(comPromessaEJargao, { runtime })
    const resposta = await deps.conversation.conversar(contaId, comPromessaEJargao.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)

    expect(etapas.filter((e) => e.tipo === "validacao").map((e) => e.status)).toEqual([
      "ok",
      "recusado",
      "ok",
    ])
    expect(resposta.saida?.origem).toBe("agente")
    expect(resposta.saida?.resposta).toBe(RESPOSTA_DE_CONFORTO)
  })

  it("o Juiz reprova por promessa e registra o jargao, e aprova na segunda leitura", async () => {
    const runtime = createScriptedRuntime(comPromessaEJargao.roteiro)
    const { contaId, deps } = await montarCenario(comPromessaEJargao, { runtime })
    const resposta = await deps.conversation.conversar(contaId, comPromessaEJargao.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(etapas.filter((e) => e.tipo === "juiz").map((e) => [e.status, e.resumo])).toEqual([
      ["recusado", "reprovado: promessa; registros: jargao"],
      ["ok", "aprovado"],
    ])
    expect(run?.juiz_tentativas).toBe(2)
    expect(run?.juiz_aprovado).toBe(true)
  })
})

describe("nova tentativa: duas reprovações seguidas viram resposta segura", () => {
  it("a segunda leitura reprova: resposta segura, sem terceira tentativa", async () => {
    const c = cenario("juiz-barra")
    const { contaId, deps } = await montarCenario(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(resposta.saida?.origem).toBe("segura")
    expect(resposta.saida?.resposta).toBe(textosDoAcompanhante.respostaSegura)
    expect(etapas.filter((e) => e.tipo === "juiz").map((e) => [e.status, e.resumo])).toEqual([
      ["recusado", "reprovado: promessa"],
      ["recusado", "reprovado: promessa"],
    ])
    expect(etapas.filter((e) => e.tipo === "erro")).toEqual([])
    expect(run?.juiz_tentativas).toBe(2)
    expect(run?.juiz_aprovado).toBe(false)
  })
})

describe("nova tentativa: bater no limite de chamadas vira resposta segura", () => {
  it("a nova tentativa para em nova_tentativa:limite e a resposta sai segura", async () => {
    // A primeira entrega usa 2 chamadas (clima e finalizar); a nova tentativa vai até o teto do run.
    const teto = loop.maxChamadasDeModelo + juiz.chamadasDaNovaTentativa
    const c: CenarioDeConversa = {
      ...cenario("juiz-corrige"),
      juiz: [{ apontamentos: [{ motivo: "promessa", trecho: "resolve a dor" }] }],
      roteiro: [
        passoDoClima,
        entregaDoCha(RESPOSTA_COM_PROMESSA),
        ...Array.from({ length: teto - 2 }, () => passoDoClima),
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
    const run = await deps.stores.runs.buscar(contaId, resposta.run_id)

    expect(etapas.filter((e) => e.tipo === "erro").map((e) => e.nome)).toEqual([
      "nova_tentativa:limite",
    ])
    expect(resposta.saida?.origem).toBe("segura")
    expect(resposta.saida?.resposta).toBe(textosDoAcompanhante.respostaSegura)
    expect(run?.juiz_aprovado).toBe(false)
  })
})
