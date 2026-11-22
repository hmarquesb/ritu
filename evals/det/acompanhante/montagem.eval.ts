import { describe, expect, it } from "vitest"
import { type ContextoDaMontagem, completarEntrega } from "@/core/agents/companion/completar"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import type { EscolhaDoModelo } from "@/core/agents/companion/saida"
import { validarEntrega } from "@/core/agents/companion/validador"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { cenarios, montarCenario } from "../../../test/fixtures/cenarios/index"

// Finalizar enxuto: o modelo escolhe; o código monta o resto. Sem rede, sem banco, sem chave.
// As fixtures do preparo são os cenários de `test/fixtures/cenarios` (só leitura), passados pelo `preparar`.

const kb = getContainer().knowledge

type Escolhida = EscolhaDoModelo["sugestoes"][number]
type Candidato = DadosDoPreparo["candidatos"][number]
type Funcao = NonNullable<Escolhida["escolhas"]>[number]["funcao"]

async function preparoDoCenario(nome: string): Promise<DadosDoPreparo> {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  const { contaId, deps } = await montarCenario(c)
  return preparar(
    { stores: deps.stores, kb, clock: deps.clock, telemetry: deps.telemetry },
    contaId,
    c.entrada,
  )
}

const contexto = (dados: DadosDoPreparo): ContextoDaMontagem => ({ dados, kb })

function escolhaDe(sugestoes: Escolhida[], extra: Partial<EscolhaDoModelo> = {}): EscolhaDoModelo {
  return { resposta: "Uma opção simples para agora.", sugestoes, incertos: [], ...extra }
}

const sugestaoDe = (c: Candidato): Escolhida => ({
  tipo: c.tipo as Escolhida["tipo"],
  id: c.id,
  motivo: "combina com o momento",
})

const todos = Object.keys(cenarios)

describe("escolha mínima de cada candidato passa pela montagem", () => {
  it.each(todos)("%s: cada candidato vira entrega sem violação de montagem", async (nome) => {
    const dados = await preparoDoCenario(nome)
    for (const c of dados.candidatos) {
      const m = completarEntrega(escolhaDe([sugestaoDe(c)]), contexto(dados))
      expect(m.ok, c.id).toBe(true)
      if (!m.ok) continue
      const montagem = validarEntrega(m.entrega, { dados, kb, sinais: sinaisVazios }).filter(
        (v) => v.origem === "montagem",
      )
      expect(montagem, c.id).toEqual([])
    }
  })

  it("as fixtures do preparo trazem candidatos para testar", async () => {
    let total = 0
    for (const nome of todos) total += (await preparoDoCenario(nome)).candidatos.length
    expect(total).toBeGreaterThan(0)
  })
})

describe("escolha fora do contrato é apontada pelo código", () => {
  it("id fora dos candidatos vira fora_dos_candidatos e lista os ids aceitos", async () => {
    const dados = await preparoDoCenario(todos[0] as string)
    const m = completarEntrega(
      escolhaDe([{ tipo: "refeicao", id: "nao-existe", motivo: "x" }]),
      contexto(dados),
    )
    expect(m.ok).toBe(false)
    if (m.ok) return
    const achada = m.violacoes.find((v) => v.codigo === "fora_dos_candidatos")
    expect(achada?.origem).toBe("modelo")
    expect(achada?.mensagem).toContain(dados.candidatos[0]?.id as string)
  })

  it("alimento fora das opcoes da vaga vira estrutura, com as opções aceitas", async () => {
    const dados = await preparoDoCenario(todos[0] as string)
    const candidato = dados.candidatos.find(
      (c) => c.tipo === "refeicao" && c.itens.some((it) => it.funcao && c.opcoes?.[it.funcao]),
    )
    expect(candidato, "há refeição com opções nas fixtures").toBeDefined()
    if (!candidato) return
    const funcao = candidato.itens.find((it) => it.funcao && candidato.opcoes?.[it.funcao])
      ?.funcao as Funcao

    const m = completarEntrega(
      escolhaDe([
        {
          tipo: "refeicao",
          id: candidato.id,
          escolhas: [{ funcao, alimento_id: "item-inexistente" }],
          motivo: "x",
        },
      ]),
      contexto(dados),
    )
    expect(m.ok).toBe(false)
    if (m.ok) return
    const achada = m.violacoes.find((v) => v.codigo === "estrutura")
    expect(achada?.mensagem).toContain("não está nas opções")
  })

  it("para_ter true sem o para_ter do contexto vira para_ter, origem modelo", async () => {
    const dados = { ...(await preparoDoCenario(todos[0] as string)), para_ter: undefined }
    const m = completarEntrega(escolhaDe([], { para_ter: true }), contexto(dados))
    expect(m.ok).toBe(false)
    if (m.ok) return
    expect(m.violacoes).toEqual([expect.objectContaining({ codigo: "para_ter", origem: "modelo" })])
  })
})

describe("citados e evitar vêm do código, não do modelo", () => {
  it("cita o alimento que a fala menciona e não repete o que já está na parte estruturada", async () => {
    const dados = await preparoDoCenario(todos[0] as string)
    const candidato = dados.candidatos.find((c) => c.itens.length > 0)
    expect(candidato).toBeDefined()
    if (!candidato) return
    const dentro = candidato.itens[0]?.alimento_id as string
    const fora = kb.alimentos.find(
      (a) => a.id !== dentro && !candidato.itens.some((i) => i.alimento_id === a.id),
    )
    expect(fora).toBeDefined()
    if (!fora) return

    const m = completarEntrega(
      escolhaDe([sugestaoDe(candidato)], {
        resposta: `Pode ajudar ${fora.nome}, e ${kb.alimento(dentro)?.nome ?? dentro} também.`,
      }),
      contexto(dados),
    )
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.entrega.citados).toContain(`alimentos:${fora.id}`)
    expect(m.entrega.citados).not.toContain(`alimentos:${dentro}`)
  })

  it("evitar vem de evitar_sempre do preparo, não da escolha", async () => {
    const dados = await preparoDoCenario(todos[0] as string)
    const candidato = dados.candidatos[0]
    if (!candidato) throw new Error("fixture sem candidato")
    const m = completarEntrega(escolhaDe([sugestaoDe(candidato)]), contexto(dados))
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.entrega.evitar).toEqual(dados.qualidades.evitar.map((x) => x.linha_base))
  })
})

describe("alimento em evitar sempre citado na fala é barrado pelo validador", () => {
  it("citados o inclui e validarEntrega devolve evitar_sempre, origem modelo", async () => {
    const clock = createFixedClock("2026-11-15T22:00:00.000Z")
    const stores = createMemoryStores(clock)
    await stores.profiles.acrescentarEvitarSempre("conta-1", [
      { tipo: "alimento", valor: "gengibre" },
    ])
    const dados = await preparar(
      { stores, kb, clock, telemetry: createMemoryTelemetry() },
      "conta-1",
      { intencoes: ["momento"], estados: ["com_frio"], evitar_da_mensagem: [] },
    )
    const candidato = dados.candidatos.find((c) => c.itens.length > 0)
    expect(candidato).toBeDefined()
    if (!candidato) return

    const m = completarEntrega(
      escolhaDe([sugestaoDe(candidato)], {
        resposta: `Um chá simples ajuda, e ${kb.alimento("gengibre")?.nome ?? "gengibre"} também.`,
      }),
      contexto(dados),
    )
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.entrega.citados).toContain("alimentos:gengibre")

    const violacoes = validarEntrega(m.entrega, { dados, kb, sinais: sinaisVazios })
    expect(violacoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: "evitar_sempre", origem: "modelo", onde: "citados[0]" }),
      ]),
    )
  })
})
