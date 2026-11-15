import { describe, expect, it } from "vitest"
import type { PedidoDePergunta } from "@/core/agents/tools/ask-user"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import {
  cenariosComPausa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { Cenario, CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

// Base: primeira conversa com casa vazia e momento de frio; cada caso troca o roteiro e a casa.
function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}
// Sem respostas roteirizadas: cada pausa recebe "pular", que não grava nada.
const base: CenarioDeConversa = { ...cenario("casa-vazia"), respostas: [] }

const ENTREGA = {
  resposta: "Respire devagar por um minuto. Se puder, sente-se para comer, sem tela.",
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
  sugestoes: [],
  evitar: [],
  // Sem sugestão, a entrega precisa registrar um incerto quando há candidatos no momento.
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}
const fin = (): PassoRoteirizado => ({
  texto: "Vou responder sem perguntar.",
  chamadas: [{ nome: "finalizar", argumentos: ENTREGA }],
})
const pede = (argumentos: PedidoDePergunta): PassoRoteirizado => ({
  texto: "Vou perguntar à pessoa.",
  chamadas: [{ nome: "ask_user", argumentos }],
})
const casa = (ids: string[]): PedidoDePergunta => ({ tipo: "casa", alimentos: ids })

// Resultado da última chamada de ask_user que o modelo recebeu.
function resultadoDoAsk(ultimo: unknown): unknown {
  const mensagens = (ultimo ?? []) as { papel?: string; nome?: string; resultado?: unknown }[]
  return mensagens.filter((m) => m.papel === "tool" && m.nome === "ask_user").at(-1)?.resultado
}

type Preparo = (deps: DepsDoCenario, contaId: string) => Promise<void>

// Roda o cenário até o fim e devolve o resultado da recusa (ou da pergunta) que o modelo recebeu.
async function rodar(c: Cenario, preparo?: Preparo) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  await preparo?.(deps, contaId)
  const rodada = await rodarCenario(deps, contaId, c)
  return { rodada, resultado: resultadoDoAsk(runtime.pedidos.at(-1)?.mensagens) }
}

describe("recusas de ask_user: cada código devolve só o seu motivo", () => {
  it("limite_de_perguntas: a terceira pergunta do run é recusada", async () => {
    const c: Cenario = {
      ...base,
      roteiro: [
        pede(casa(["mandioca"])),
        pede(casa(["inhame"])),
        pede(casa(["batata-doce"])),
        fin(),
      ],
    }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({ perguntou: false, motivo: "limite_de_perguntas" })
    expect(rodada.perguntas).toHaveLength(2)
    expect(rodada.final.status).toBe("done")
  })

  it("muitos_itens: mais de cinco alimentos numa pergunta", async () => {
    const c: Cenario = {
      ...base,
      roteiro: [
        pede(casa(["mandioca", "batata-doce", "inhame", "ghee", "azeite", "gengibre"])),
        fin(),
      ],
    }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({ perguntou: false, motivo: "muitos_itens" })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("fora_da_base: alimento que não está na base", async () => {
    const c: Cenario = { ...base, roteiro: [pede(casa(["alimento-inventado"])), fin()] }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({
      perguntou: false,
      motivo: "fora_da_base",
      alimentos: ["alimento-inventado"],
    })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("ja_confirmado: alimento que já está confirmado em casa", async () => {
    const c: Cenario = {
      ...base,
      casa: [{ alimento_id: "mandioca" }],
      roteiro: [pede(casa(["mandioca"])), fin()],
    }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({
      perguntou: false,
      motivo: "ja_confirmado",
      alimentos: ["mandioca"],
    })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("filtrado: alimento que a pessoa pediu para evitar sempre", async () => {
    const c: Cenario = {
      ...base,
      perfil: { ...base.perfil, evitar_sempre: [{ tipo: "alimento", valor: "mandioca" }] },
      roteiro: [pede(casa(["mandioca"])), fin()],
    }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({ perguntou: false, motivo: "filtrado", alimentos: ["mandioca"] })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("acabou: alimento que saiu de casa", async () => {
    const c: Cenario = {
      ...base,
      casa: [{ alimento_id: "mandioca" }],
      roteiro: [pede(casa(["mandioca"])), fin()],
    }
    const { resultado, rodada } = await rodar(c, async (deps, contaId) => {
      await deps.stores.pantry.marcarAcabou(contaId, [{ alimento_id: "mandioca" }])
    })

    expect(resultado).toEqual({ perguntou: false, motivo: "acabou", alimentos: ["mandioca"] })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("fora_dos_candidatos: alimento que não entra em nenhum candidato do momento", async () => {
    const c: Cenario = { ...base, roteiro: [pede(casa(["manga"])), fin()] }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({
      perguntou: false,
      motivo: "fora_dos_candidatos",
      alimentos: ["manga"],
    })
    expect(rodada.perguntas).toHaveLength(0)
  })

  it("ja_perguntado: alimento que já foi perguntado neste run", async () => {
    const c: Cenario = {
      ...base,
      roteiro: [pede(casa(["mandioca"])), pede(casa(["mandioca"])), fin()],
      respostas: [{ tipo: "pular" }],
    }
    const { resultado, rodada } = await rodar(c)

    expect(resultado).toEqual({
      perguntou: false,
      motivo: "ja_perguntado",
      alimentos: ["mandioca"],
    })
    expect(rodada.perguntas).toHaveLength(1)
  })

  it("come_desnecessaria: a pessoa já gosta do alimento, então não se pergunta se ela come", async () => {
    const c: Cenario = {
      ...base,
      roteiro: [pede({ tipo: "come", alimento: "ghee" }), fin()],
    }
    const { resultado, rodada } = await rodar(c, async (deps, contaId) => {
      await deps.stores.preferences.definirGosto(contaId, { tipo: "alimento", id: "ghee" }, "gosta")
    })

    expect(resultado).toEqual({
      perguntou: false,
      motivo: "come_desnecessaria",
      alimentos: ["ghee"],
    })
    expect(rodada.perguntas).toHaveLength(0)
  })
})

describe("recusas de ask_user: um pedido limpo pausa", () => {
  it("uma pergunta de casa válida pausa o run com a pergunta", async () => {
    const c: CenarioDeConversa = {
      ...base,
      roteiro: [pede(casa(["mandioca", "batata-doce"])), fin()],
    }
    const runtime = createScriptedRuntime(c.roteiro)
    const { contaId, deps } = await montarCenario(c, { runtime })
    const r = await deps.conversation.conversar(contaId, c.mensagem)

    expect(r.status).toBe("waiting_for_input")
    expect(r.pergunta?.tipo).toBe("casa")
  })
})
