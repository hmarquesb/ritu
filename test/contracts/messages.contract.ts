import { beforeEach, describe, expect, it } from "vitest"
import type { Stores } from "@/core/stores"
import { type ContractEnv, criarDuasContas } from "./env"

const DIA = "2026-01-15"
const UM_MINUTO = 60_000
const UM_DIA = 86_400_000

type Entrada = {
  run_id?: string
  autor: "pessoa" | "agente"
  texto: string
  com_incomodo: boolean
  dia: string
}

const entrada = (texto: string, extra: Partial<Entrada> = {}): Entrada => ({
  autor: "pessoa",
  texto,
  com_incomodo: false,
  dia: DIA,
  ...extra,
})

async function criarRun(stores: Stores, contaId: string): Promise<string> {
  const run = await stores.runs.criar(contaId, { caminho: "casa", intencoes: [], dia: DIA })
  return run.id
}

export function messagesContract(make: () => Promise<ContractEnv> | ContractEnv): void {
  describe("contrato: MessageRepository", () => {
    let env: ContractEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("gravar devolve a mensagem com run_id nulo quando não há run", async () => {
      const { a } = await criarDuasContas(env.stores)
      const mensagem = await env.stores.messages.gravar(a, entrada("oi"))

      expect(mensagem).toMatchObject({
        conta_id: a,
        run_id: null,
        autor: "pessoa",
        texto: "oi",
        com_incomodo: false,
        dia: DIA,
        criado_em: "2026-01-15T12:00:00.000Z",
      })
    })

    it("doDia devolve as mensagens do dia em ordem e deixa de fora as de outros dias", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { messages } = env.stores
      await messages.gravar(a, entrada("primeira"))
      env.clock.advance(UM_MINUTO)
      await messages.gravar(a, entrada("segunda"))
      await messages.gravar(a, entrada("outro dia", { dia: "2026-01-14" }))

      const doDia = await messages.doDia(a, DIA)
      expect(doDia.map((m) => m.texto)).toEqual(["primeira", "segunda"])
    })

    it("marcarIncomodoDoRun marca as mensagens desse run e só essas", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { messages } = env.stores
      const runId = await criarRun(env.stores, a)
      await messages.gravar(a, entrada("da pessoa", { run_id: runId }))
      env.clock.advance(UM_MINUTO)
      await messages.gravar(a, entrada("do agente", { run_id: runId, autor: "agente" }))
      env.clock.advance(UM_MINUTO)
      await messages.gravar(a, entrada("sem run"))

      await messages.marcarIncomodoDoRun(a, runId)

      const doDia = await messages.doDia(a, DIA)
      expect(doDia.map((m) => [m.texto, m.com_incomodo])).toEqual([
        ["da pessoa", true],
        ["do agente", true],
        ["sem run", false],
      ])
    })

    it("apagarAntesDe apaga as mensagens com criado_em anterior ao limite e devolve a contagem", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { messages } = env.stores
      await messages.gravar(a, entrada("antiga"))
      env.clock.advance(8 * UM_DIA)
      await messages.gravar(a, entrada("recente"))
      const limite = new Date(env.clock.now().getTime() - UM_DIA)

      expect(await messages.apagarAntesDe(limite)).toBe(1)
      expect((await messages.doDia(a, DIA)).map((m) => m.texto)).toEqual(["recente"])
    })

    it("apagarComIncomodoAntesDoDia apaga só as marcadas de dias anteriores", async () => {
      const { a } = await criarDuasContas(env.stores)
      const { messages } = env.stores
      await messages.gravar(
        a,
        entrada("incomodo antigo", { com_incomodo: true, dia: "2026-01-14" }),
      )
      await messages.gravar(a, entrada("comum antigo", { dia: "2026-01-14" }))
      await messages.gravar(a, entrada("incomodo de hoje", { com_incomodo: true }))

      expect(await messages.apagarComIncomodoAntesDoDia(DIA)).toBe(1)
      expect((await messages.doDia(a, "2026-01-14")).map((m) => m.texto)).toEqual(["comum antigo"])
      expect((await messages.doDia(a, DIA)).map((m) => m.texto)).toEqual(["incomodo de hoje"])
    })

    it("conta B não lê nem marca as mensagens da conta A", async () => {
      const { a, b } = await criarDuasContas(env.stores)
      const { messages } = env.stores
      const runId = await criarRun(env.stores, a)
      await messages.gravar(a, entrada("oi", { run_id: runId }))

      expect(await messages.doDia(b, DIA)).toEqual([])
      await messages.marcarIncomodoDoRun(b, runId)

      expect(await messages.doDia(a, DIA)).toMatchObject([{ texto: "oi", com_incomodo: false }])
    })
  })
}
