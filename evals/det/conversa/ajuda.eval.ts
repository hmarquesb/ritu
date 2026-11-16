import { describe, expect, it } from "vitest"
import { textosDaConversa } from "@/core/conversation/textos"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import { cenario, com } from "./apoio"

// Pergunta sobre o próprio Ritu: o caminho ajuda é de código, sem Acompanhante e sem Juiz.
const PERGUNTA = "como você usa o que eu conto?"

async function rodar() {
  const c = com(cenario("ofensa"), PERGUNTA, { intencoes: ["ajuda"] })
  // A fila traz só a saída do Intérprete: se o Juiz ou o Acompanhante rodassem, o teste veria mais pedidos.
  const llm = createFakeLlm(c.interpretacao ? [c.interpretacao] : [])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  return { llm, runtime, resposta, run, etapas }
}

describe("ajuda: pergunta sobre o Ritu não chama o Acompanhante nem o Juiz", () => {
  it("cai no caminho ajuda, sem o Acompanhante", async () => {
    const { run, runtime } = await rodar()

    expect(run?.caminho).toBe("ajuda")
    expect(runtime.pedidos).toHaveLength(0)
  })

  it("só o Intérprete chama o modelo: nenhum pedido depois dele", async () => {
    const { llm } = await rodar()

    expect(llm.pedidos).toHaveLength(1)
  })

  it("não há etapa do Juiz no run", async () => {
    const { etapas } = await rodar()

    expect(etapas.filter((e) => e.tipo === "juiz")).toEqual([])
  })

  it("a resposta sai do código, com o texto fixo do caminho", async () => {
    const { resposta } = await rodar()

    expect(resposta.saida?.resposta).toBe(textosDaConversa.ajuda)
  })
})
