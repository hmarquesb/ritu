import { afterEach, describe, expect, it, vi } from "vitest"
import { copiarSeed } from "@/core/accounts/copiar-seed"
import { createContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"

// O momento do dia muda os candidatos do agente (de manhã e ao almoço a couve não entra). O roteiro da pergunta de
// casa conta com a couve, então o relógio fica fixo à noite (21h em São Paulo), salvo pedido.
const NOITE_SP = "2026-11-18T00:00:00Z"

async function novoContainer(agora = NOITE_SP) {
  vi.stubEnv("RITU_MODO", "e2e")
  const container = createContainer({ clock: createFixedClock(agora) })
  const conta = await container.stores.accounts.criar({ tipo: "demo" })
  await copiarSeed(container.stores, conta.id, container.demoSeed, {
    clock: container.clock,
    kb: container.knowledge,
  })
  return { container, contaId: conta.id }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("modo e2e: roteiros", () => {
  it("demo: termina no bloco com a linha de lista e a do padrão", async () => {
    const { container, contaId } = await novoContainer()

    const r = await container.conversation.conversar(contaId, {
      texto: container.demoSeed.mensagem_sugerida,
      atalhos: [],
    })

    expect(r.status).toBe("waiting_for_approval")
    expect(r.caminho).toBe("acompanhante")
    const tipos = r.saida?.propostas.map((p) => p.tool) ?? []
    expect(tipos).toContain("lista.propor")
    expect(tipos).toContain("padrao.confirmar")
    expect(r.saida?.sugestoes.map((s) => s.pratica_id ?? s.preparo_id)).toEqual([
      "banho-morno",
      "caldo",
    ])
  })

  it.each([
    "2026-11-17T06:00:00Z",
    "2026-11-18T01:00:00Z",
    "2026-11-18T00:00:00Z",
    "2026-11-18T02:30:00Z",
  ])("pergunta-casa: pergunta de couve e leite e, com a resposta, entrega (%s)", async (agora) => {
    const { container, contaId } = await novoContainer(agora)

    const r = await container.conversation.conversar(contaId, {
      texto: "fui à feira ontem, o que faço pro jantar?",
      atalhos: [],
    })

    expect(r.status).toBe("waiting_for_input")
    expect(r.pergunta?.tipo).toBe("casa")
    expect(JSON.stringify(r.pergunta)).toContain("couve")
    expect(JSON.stringify(r.pergunta)).toContain("leite")

    const depois = await container.conversation.continuar(contaId, r.run_id, {
      tipo: "casa",
      itens: [
        { alimento_id: "couve", resposta: "tenho" },
        { alimento_id: "leite", resposta: "nao_tenho" },
      ],
    })

    expect(depois.status).not.toBe("waiting_for_input")
    expect(depois.saida?.sugestoes).toHaveLength(1)
  })

  it("troca: entrega um chá de gengibre e a troca do gengibre pergunta pelo substituto", async () => {
    const { container, contaId } = await novoContainer()

    const r = await container.conversation.conversar(contaId, {
      texto: "quero um chá quente agora",
      atalhos: [],
    })

    const sugestao = r.saida?.sugestoes[0]
    expect(sugestao?.itens.map((i) => i.alimento_id)).toEqual(["gengibre"])
    const troca = await container.touches.trocarIngrediente(contaId, {
      runId: r.run_id,
      sugestao: 0,
      alimento_id: "gengibre",
      motivo: "trocar",
    })
    expect(["trocou", "perguntar"]).toContain(troca.resultado)
  })

  it("texto-cru: a resposta traz a tag e a marcação literais", async () => {
    const { container, contaId } = await novoContainer()

    const r = await container.conversation.conversar(contaId, {
      texto: "mostra um texto estranho",
      atalhos: [],
    })

    expect(r.saida?.resposta).toContain("<script>alert(1)</script>")
    expect(r.saida?.resposta).toContain("**negrito**")
  })

  it("lento: cada passo demora de verdade", async () => {
    const { container, contaId } = await novoContainer()
    const inicio = Date.now()

    const r = await container.conversation.conversar(contaId, {
      texto: "demora um pouco",
      atalhos: [],
    })

    expect(Date.now() - inicio).toBeGreaterThanOrEqual(850)
    expect(r.saida?.sugestoes).toHaveLength(1)
  })

  it("mensagem sem roteiro: caminho sem_modelo, com resposta montada por código", async () => {
    const { container, contaId } = await novoContainer()

    const r = await container.conversation.conversar(contaId, {
      texto: "uma mensagem que ninguém roteirizou",
      atalhos: [],
    })

    expect(r.caminho).toBe("sem_modelo")
    expect(r.saida?.resposta.length).toBeGreaterThan(0)
  })

  it("o clima é o fixo: frio e úmido, sem rede", async () => {
    const { container } = await novoContainer()

    const clima = await container.weather.buscar({ lat: -22.91, lon: -43.21 })

    expect(clima.temperatura_aparente).toBe(16)
    expect(clima.umidade).toBe(88)
  })
})
