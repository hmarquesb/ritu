import { describe, expect, it } from "vitest"
import { textosDaConversa } from "@/core/conversation/textos"
import { registrarResultado } from "@/core/outcomes/registrar"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

type Resultado = "ajudou" | "nao_ajudou" | "nao_fez"

// Título como está guardado na sugestão; na frase, a primeira letra vira minúscula.
const TITULO_DO_CHA = "Chá de gengibre com canela"
const TITULO_DO_ARROZ = "Arroz bem cozido com abóbora e ghee"
const CHA_NA_FRASE = "chá de gengibre com canela"

// "Tomei o chá" ligado ao pendente de número `pendente` (1 é o mais recente).
function mensagemDeRetorno(pendente: number, resultado: Resultado): CenarioDeConversa {
  return com(cenario("retorno-conversa"), "tomei o chá e melhorei", {
    intencoes: ["retorno"],
    retorno: { resultado, pendente },
  })
}

async function montar(c: CenarioDeConversa) {
  const llm = createFakeLlm(c.interpretacao ? [c.interpretacao] : [])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  return { contaId, deps, runtime }
}

async function preferenciaDe(
  deps: Awaited<ReturnType<typeof montar>>["deps"],
  contaId: string,
  tipo: string,
  id: string,
) {
  const prefs = await deps.stores.preferences.ler(contaId)
  return prefs.find((p) => p.item_tipo === tipo && p.item_id === id)
}

describe("retorno ligado: o pendente recebe o resultado e os contadores sobem", () => {
  it("'tomei o chá' liga ao pendente mais recente, que sai da lista e conta no chá e nos ingredientes", async () => {
    const c = mensagemDeRetorno(1, "ajudou")
    const { contaId, deps } = await montar(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    expect(resposta.saida.resposta).toBe(
      textosDaConversa.retornoAjudou.replace("{titulo}", () => CHA_NA_FRASE),
    )
    expect(await preferenciaDe(deps, contaId, "pratica", "cha-gengibre-canela")).toMatchObject({
      ajudou: 1,
      ultimos_resultados: ["ajudou"],
    })
    expect(await preferenciaDe(deps, contaId, "alimento", "gengibre")).toMatchObject({ ajudou: 1 })
    expect(await preferenciaDe(deps, contaId, "alimento", "canela")).toMatchObject({ ajudou: 1 })

    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.map((r) => r.sugestao.titulo)).toEqual([TITULO_DO_ARROZ])
  })
})

describe("retorno sem ligação: nada é anotado nem contado", () => {
  it("sem pendente nenhum, o texto avisa e nenhum contador sobe", async () => {
    const base = { ...cenario("retorno-conversa"), retornos: [] }
    const c = com(base, "tomei o chá e melhorei", {
      intencoes: ["retorno"],
      retorno: { resultado: "ajudou", pendente: 1 },
    })
    const { contaId, deps } = await montar(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    expect(resposta.saida.resposta).toBe(textosDaConversa.retornoSemLigacao)
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
  })

  it("número fora da lista: avisa, nada conta e os dois pendentes seguem aguardando", async () => {
    const c = mensagemDeRetorno(5, "ajudou")
    const { contaId, deps } = await montar(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    expect(resposta.saida.resposta).toBe(textosDaConversa.retornoSemLigacao)
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(await deps.stores.outcomes.pendentes(contaId)).toHaveLength(2)
  })
})

describe("retorno já respondido: o resultado não muda e os contadores somam uma vez", () => {
  it("responder de novo o mesmo pendente não troca o resultado nem soma outra vez", async () => {
    const c = mensagemDeRetorno(1, "ajudou")
    const { contaId, deps } = await montar(c)
    const [cha] = await deps.stores.outcomes.pendentes(contaId)
    expect(cha?.sugestao.titulo).toBe(TITULO_DO_CHA)

    await deps.conversation.conversar(contaId, c.mensagem)
    // O chá já foi respondido: uma segunda resposta para ele não troca nem soma.
    await registrarResultado(
      { tx: { emTransacao: (fn) => fn(deps.stores) }, telemetry: deps.telemetry },
      contaId,
      cha?.id ?? "",
      "nao_ajudou",
      "conversa",
    )

    expect(await preferenciaDe(deps, contaId, "pratica", "cha-gengibre-canela")).toMatchObject({
      ajudou: 1,
      nao_ajudou: 0,
    })
    const [respondido] = (await deps.stores.outcomes.doRun(contaId, cha?.run_id ?? "")).filter(
      (r) => r.id === cha?.id,
    )
    expect(respondido?.resultado).toBe("ajudou")
  })
})

describe("não fez: conta em nao_fez e não entra em ultimos_resultados", () => {
  it("o texto fala do não feito e o chá fica com nao_fez 1 e ultimos_resultados vazio", async () => {
    const c = mensagemDeRetorno(1, "nao_fez")
    const { contaId, deps } = await montar(c)
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    expect(resposta.saida.resposta).toBe(
      textosDaConversa.retornoNaoFez.replace("{titulo}", () => CHA_NA_FRASE),
    )
    expect(await preferenciaDe(deps, contaId, "pratica", "cha-gengibre-canela")).toMatchObject({
      nao_fez: 1,
      ultimos_resultados: [],
    })
  })
})
