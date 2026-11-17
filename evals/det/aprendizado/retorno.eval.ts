import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { preparar } from "@/core/agents/companion/preparo"
import type { Preferencia } from "@/core/preferences/ports"
import { getContainer } from "@/infra/container"
import {
  cenariosDeAprendizado,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa, Toque } from "../../../test/fixtures/cenarios/tipos"

// Retorno: o resultado do pendente soma nos itens, pelo toque ou pela conversa; um só toque vale; "não ajudou" seguido manda para o fim.

const kb = getContainer().knowledge

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosDeAprendizado[nome] ?? cenariosDeConversa[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// Um retorno de chá de gengibre, há `dias` dias; a ordem dos semeados é a da lista.
const cha = (dias: number) => ({
  sugestao: {
    tipo: "cha" as const,
    pratica_id: "cha-gengibre",
    alimentos: ["gengibre"],
    titulo: "Chá de gengibre",
  },
  diasAtras: dias,
})

// Os contadores dos itens do retorno de arroz: o que o toque e a conversa precisam deixar igual.
const ITENS_DO_ARROZ: [string, string][] = [
  ["preparo", "arroz-com-legume"],
  ["alimento", "arroz-branco"],
  ["alimento", "abobora"],
]

function contadores(prefs: Preferencia[], itens: [string, string][]) {
  return itens.map(([tipo, id]) => {
    const p = prefs.find((x) => x.item_tipo === tipo && x.item_id === id)
    return p ? { ajudou: p.ajudou, nao_ajudou: p.nao_ajudou, ultimos: p.ultimos_resultados } : null
  })
}

function retornosNoToque(rodada: { toques?: { tipo: string }[] }) {
  return (rodada.toques ?? []).filter((t) => t.tipo === "retorno")
}

describe("toque e conversa somam igual", () => {
  it("'tomei o arroz' pela conversa e o toque 'Ajudou' no mesmo retorno deixam os mesmos contadores", async () => {
    // Conversa: o Intérprete liga "ajudou" ao pendente 1 (o arroz, o mais recente).
    const conversa = cenario("retorno-pelo-agente")
    const porConversa = await montarCenario(conversa)
    await rodarCenario(porConversa.deps, porConversa.contaId, conversa)

    // Toque: o mesmo arroz (semeado 0), sem mensagem de retorno.
    const base = cenario("entrega-registrada")
    const comToque: CenarioDeConversa = {
      ...base,
      retornos: cenario("retorno-pelo-agente").retornos,
      toques: [{ tipo: "retorno", sugestao: 0, resultado: "ajudou", semeado: true }],
    }
    const porToque = await montarCenario(comToque)
    await rodarCenario(porToque.deps, porToque.contaId, comToque)

    const daConversa = contadores(
      await porConversa.deps.stores.preferences.ler(porConversa.contaId),
      ITENS_DO_ARROZ,
    )
    const doToque = contadores(
      await porToque.deps.stores.preferences.ler(porToque.contaId),
      ITENS_DO_ARROZ,
    )
    expect(daConversa).toEqual([
      { ajudou: 1, nao_ajudou: 0, ultimos: ["ajudou"] },
      { ajudou: 1, nao_ajudou: 0, ultimos: ["ajudou"] },
      { ajudou: 1, nao_ajudou: 0, ultimos: ["ajudou"] },
    ])
    expect(doToque).toEqual(daConversa)
  })

  it("cada um soma a sua origem na métrica ritu_retorno_total", async () => {
    const conversa = cenario("retorno-pelo-agente")
    const porConversa = await montarCenario(conversa)
    await rodarCenario(porConversa.deps, porConversa.contaId, conversa)
    const origens = porConversa.deps.telemetry.metricas
      .filter((m) => m.nome === "ritu_retorno_total")
      .map((m) => m.rotulos)

    expect(origens).toEqual([{ resultado: "ajudou", origem: "conversa" }])
  })
})

describe("um só toque vale", () => {
  it("o segundo toque no mesmo retorno não soma, mesmo com outro resultado", async () => {
    const base = cenario("dois-nao-ajudou")
    const c: CenarioDeConversa = {
      ...base,
      depois: undefined,
      toques: [
        { tipo: "retorno", sugestao: 0, resultado: "ajudou", semeado: true },
        { tipo: "retorno", sugestao: 0, resultado: "nao_ajudou", semeado: true },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const [primeiro, segundo] = retornosNoToque(rodada)

    const pratica = (await deps.stores.preferences.ler(contaId)).find(
      (p) => p.item_tipo === "pratica" && p.item_id === "cha-gengibre",
    )
    expect(pratica).toMatchObject({ ajudou: 1, nao_ajudou: 0 })
    expect(primeiro).toMatchObject({ retorno: { resultado: "ajudou" } })
    expect(segundo).toMatchObject({ retorno: { resultado: "ajudou" } })
    const metricas = deps.telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")
    expect(metricas).toHaveLength(1)
  })
})

// Preparo da mensagem seguinte: o que o agente vê de cada chá, depois dos toques.
async function preparoSeguinte(deps: DepsDoCenario, contaId: string) {
  const entrada: EntradaDoAcompanhante = {
    texto: "e agora, o que tomo?",
    intencoes: ["momento"],
    estados: ["com_frio"],
    evitar_da_mensagem: [],
  }
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    entrada,
  )
}

// Os chás do preparo seguinte, na ordem do tipo: a posição fica em `candidatos_completos`, e `candidatos` traz o
// que o corte de quatro chás deixa. À noite, com frio, a base tem só quatro chás possíveis, então o que vai para o
// fim (no_fim) segue no contexto, por último. O corte que o tira fica em src/core/ranking/candidatos.test.ts.
function chasDoPreparo(dados: Awaited<ReturnType<typeof preparoSeguinte>>) {
  const completos = dados.candidatos_completos.filter((id) =>
    dados.candidatos_do_preparo.some((c) => c.tipo === "cha" && c.id === id),
  )
  const noContexto = dados.candidatos.filter((x) => x.tipo === "cha")
  return { completos, noContexto }
}

describe("não ajudou seguido manda para o fim; um ajudou traz de volta", () => {
  const base = cenario("dois-nao-ajudou")
  const naoAjudou = (i: number): Toque => ({
    tipo: "retorno",
    sugestao: i,
    resultado: "nao_ajudou",
    semeado: true,
  })
  const ajudou = (i: number): Toque => ({
    tipo: "retorno",
    sugestao: i,
    resultado: "ajudou",
    semeado: true,
  })
  const retornos = [cha(3), cha(2), cha(1)]

  it("dois 'não ajudou' seguidos: o chá vai para o fim do tipo (no_fim), na ordem e no contexto", async () => {
    const c: CenarioDeConversa = {
      ...base,
      retornos,
      depois: undefined,
      toques: [naoAjudou(0), naoAjudou(1)],
    }
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    const { completos, noContexto } = chasDoPreparo(await preparoSeguinte(deps, contaId))

    expect(completos.at(-1)).toBe("cha-gengibre")
    expect(completos.indexOf("cha-gengibre")).toBeGreaterThan(0)
    expect(noContexto.at(-1)?.id).toBe("cha-gengibre")
    expect(noContexto.at(-1)?.no_fim).toBe(true)
    expect(noContexto.slice(0, -1).some((x) => x.no_fim)).toBe(false)
  })

  it("um 'ajudou' depois dos dois: o chá sai do fim e volta à frente do tipo, no contexto", async () => {
    const c: CenarioDeConversa = {
      ...base,
      retornos,
      depois: undefined,
      toques: [naoAjudou(0), naoAjudou(1), ajudou(2)],
    }
    const { contaId, deps } = await montarCenario(c)
    await rodarCenario(deps, contaId, c)
    const { completos, noContexto } = chasDoPreparo(await preparoSeguinte(deps, contaId))
    const chaNoContexto = noContexto.find((x) => x.id === "cha-gengibre")

    expect(completos[0]).toBe("cha-gengibre")
    expect(chaNoContexto).toMatchObject({ no_fim: false, ajudou: 1 })
  })
})

describe("retorno de outra conta é recusado", () => {
  it("outra conta não toca o retorno: toque_invalido, e nada muda nem soma", async () => {
    const c = cenario("dois-nao-ajudou")
    const { contaId, deps } = await montarCenario({ ...c, depois: undefined })
    const outra = await deps.stores.accounts.criar({ tipo: "demo" })

    await expect(
      deps.touches.tocarRetorno(outra.id, deps.retornosSemeados[0] ?? "", "ajudou"),
    ).rejects.toMatchObject({ code: "toque_invalido" })

    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes).toHaveLength(2)
    expect(pendentes.every((p) => p.status === "aguardando")).toBe(true)
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(deps.telemetry.metricas.filter((m) => m.nome === "ritu_retorno_total")).toEqual([])
  })
})
