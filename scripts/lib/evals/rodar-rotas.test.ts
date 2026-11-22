import { describe, expect, it } from "vitest"
import type { CasoConversa } from "../../../evals/llm/casos/c2"
import type { Run } from "../../../src/core/runs/ports"
import { createFakeLlm } from "../../../src/infra/fakes/fake-llm"
import { createScriptedRuntime } from "../../../src/infra/fakes/scripted-runtime"
import {
  cenariosDeConversa,
  type PassoDeRota,
  RotaFalhouError,
} from "../../../test/fixtures/cenarios"
import { checagensDeRota, falhaDaRota, rodarConversaPelasRotas } from "./rodar-rotas"
import { rodarConversa } from "./rodar-run"

const soAtalhos = cenariosDeConversa["so-atalhos"]
if (!soAtalhos) throw new Error("cenário so-atalhos ausente")

const { roteiro, ...semRoteiro } = soAtalhos

const casoConversa: CasoConversa = {
  tipo: "conversa",
  familias: ["conversa"],
  id: "t-rotas-conversa",
  titulo: "Só atalhos pelas rotas",
  cenario: semRoteiro,
  deve: [
    {
      descricao: "responde como agente",
      confere: ({ resultado }) => resultado.saida.origem === "agente",
    },
  ],
  naoPode: [
    {
      descricao: "não sai sem modelo",
      confere: ({ resposta }) => resposta.saida?.origem !== "sem_modelo",
    },
  ],
}

const rodarPelasRotas = () =>
  rodarConversaPelasRotas(casoConversa, {
    runtime: createScriptedRuntime(roteiro),
    llm: createFakeLlm([{ apontamentos: [] }]),
  })

// Um run mínimo com a resposta gravada: as checagens de run_id e de texto só leem `id` e `saida`.
const runDe = (id: string, resposta: string): Run => ({ id, saida: { resposta } }) as unknown as Run

const passosDeConversa = (runId: string): PassoDeRota[] => [
  {
    rota: "POST /api/runs",
    status: 200,
    eventos: [
      { tipo: "inicio", run_id: runId },
      {
        tipo: "fim",
        visao: { run_id: runId, resposta: "Oi" } as never,
        pendentes: 0,
        limites: {} as never,
      },
    ],
  },
]

describe("checagensDeRota", () => {
  it("com tudo certo, devolve as cinco checagens de rota verdadeiras", () => {
    const checagens = checagensDeRota(passosDeConversa("run-1"), runDe("run-1", "Oi"))

    expect(checagens.map((c) => c.lista)).toEqual(["rota", "rota", "rota", "rota", "rota"])
    expect(checagens.map((c) => c.ok)).toEqual([true, true, true, true, true])
    expect(checagens[0]?.descricao).toBe("toda rota respondeu 200")
  })

  it("um passo 500 deixa a checagem de status falsa com a rota e o código", () => {
    const passos = passosDeConversa("run-1").map((p) => ({ ...p, status: 500 }))

    const [status] = checagensDeRota(passos, runDe("run-1", "Oi"))

    expect(status?.ok).toBe(false)
    expect(status?.descricao).toBe("POST /api/runs respondeu 500")
  })

  it("um 429 vira a descrição de rota barrada", () => {
    const passos = passosDeConversa("run-1").map((p) => ({ ...p, status: 429 }))

    const [status] = checagensDeRota(passos, runDe("run-1", "Oi"))

    expect(status?.descricao).toBe("a rota barrou a conversa (429)")
  })

  it("o segundo POST /api/runs com 409 vira a descrição de run aberto", () => {
    const passos: PassoDeRota[] = [
      ...passosDeConversa("run-1"),
      { rota: "POST /api/runs/[id]/resposta", status: 200 },
      { rota: "POST /api/runs", status: 409 },
    ]

    const [status] = checagensDeRota(passos, runDe("run-1", "Oi"))

    expect(status?.ok).toBe(false)
    expect(status?.descricao).toBe("havia um run aberto (409)")
  })

  it("linha que não valida no schema deixa a checagem 2 falsa", () => {
    const passos = passosDeConversa("run-1")
    passos[0] = { ...passos[0], erroDeSchema: "{}" } as PassoDeRota

    const checagens = checagensDeRota(passos, runDe("run-1", "Oi"))

    expect(checagens[1]?.descricao).toBe("cada linha do NDJSON valida no schema do evento")
    expect(checagens[1]?.ok).toBe(false)
  })

  it("fluxo sem fim deixa a checagem 3 falsa", () => {
    const passos = passosDeConversa("run-1")
    const eventos = (passos[0]?.eventos ?? []).filter((e) => e.tipo !== "fim")
    passos[0] = { ...passos[0], eventos } as PassoDeRota

    const checagens = checagensDeRota(passos, runDe("run-1", "Oi"))

    expect(checagens[2]?.ok).toBe(false)
  })

  it("run_id diferente do run gravado deixa a checagem 4 falsa", () => {
    const checagens = checagensDeRota(passosDeConversa("run-1"), runDe("outro", "Oi"))

    expect(checagens[3]?.descricao).toBe("o run_id do inicio é o do run gravado")
    expect(checagens[3]?.ok).toBe(false)
  })

  it("texto da visão diferente do gravado no run deixa a checagem 5 falsa", () => {
    const checagens = checagensDeRota(passosDeConversa("run-1"), runDe("run-1", "Outro texto"))

    expect(checagens[4]?.ok).toBe(false)
  })

  it("sem run, as checagens 4 e 5 saem falsas", () => {
    const checagens = checagensDeRota(passosDeConversa("run-1"))

    expect(checagens[3]?.ok).toBe(false)
    expect(checagens[4]?.ok).toBe(false)
  })

  it("sem nenhum passo, não há checagens de rota", () => {
    expect(checagensDeRota([], runDe("run-1", "Oi"))).toEqual([])
  })
})

describe("rodarConversaPelasRotas", () => {
  it("mantém as checagens deve e nao_pode de rodarConversa e acrescenta cinco de rota verdadeiras", async () => {
    const pelasRotas = await rodarPelasRotas()
    const pelaRodada = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([{ apontamentos: [] }]),
    })

    const naoRota = pelasRotas.resultado.checagens.filter((c) => c.lista !== "rota")
    expect(naoRota).toEqual(pelaRodada.resultado.checagens)
    const deRota = pelasRotas.resultado.checagens.filter((c) => c.lista === "rota")
    expect(deRota).toHaveLength(5)
    expect(deRota.every((c) => c.ok === true)).toBe(true)
    expect(pelasRotas.resultado.estado).toBe("acertou")
  })
})

describe("rodada que falha numa rota", () => {
  it("cai como falhou, nunca como inconclusivo, com o erro da rota e as expectativas não cumpridas", async () => {
    const { resultado } = await rodarConversa(casoConversa, {
      runtime: createScriptedRuntime(roteiro),
      llm: createFakeLlm([]),
      rodar: async () => {
        throw new RotaFalhouError([{ rota: "POST /api/runs", status: 429 }])
      },
      falha: falhaDaRota,
    })

    expect(resultado.estado).toBe("falhou")
    expect(resultado.inconclusivo).toBeUndefined()
    expect(resultado.acertou).toBe(false)
    expect(resultado.erro).toBe("a rota barrou a conversa (429)")
    const deve = resultado.checagens.filter((c) => c.lista === "deve")
    const naoPode = resultado.checagens.filter((c) => c.lista === "nao_pode")
    expect(deve.map((c) => c.ok)).toEqual([false])
    expect(naoPode.map((c) => c.ok)).toEqual([false])
    expect(resultado.checagens.filter((c) => c.lista === "rota")[0]?.ok).toBe(false)
  })
})
