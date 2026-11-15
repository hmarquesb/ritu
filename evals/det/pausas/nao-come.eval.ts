import { describe, expect, it } from "vitest"
import { dadosDoPreparoSchema } from "@/core/agents/companion/preparo"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosComPausa, montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

function cenario(nome: string): CenarioDeConversa {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário com pausa ausente: ${nome}`)
  return c
}

// Base: primeira conversa com casa vazia e jantar frio; cada caso troca o roteiro e a resposta.
// Manhã com frio: o ovo mexido só é candidato de manhã (vagas do preparo), então o relógio fica às 8h.
const base: CenarioDeConversa = {
  ...cenario("casa-vazia"),
  agora: "2026-06-15T11:00:00.000Z",
  mensagem: { texto: "estou com frio, o que como no café da manhã?", atalhos: [] },
}

const PERGUNTA_OVO: PassoRoteirizado = {
  texto: "Vou confirmar se a pessoa come ovo.",
  chamadas: [{ nome: "ask_user", argumentos: { tipo: "come", alimento: "ovo" } }],
}
const PERGUNTA_CASA: PassoRoteirizado = {
  texto: "Vou confirmar a abóbora com a pessoa.",
  chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["abobora"] } }],
}

const SEM_OVO = {
  resposta:
    "Para este fim de tarde frio, uma comida morna ajuda a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
  sugestoes: [],
  evitar: [],
  incertos: ["Não sei o que há na sua casa."],
  citados: [],
}

// Entrega que sugere ovo mexido, como o modelo escreveria se não soubesse da recusa.
const COM_OVO = {
  resposta:
    "Um ovo mexido morno ajuda a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
  sugestoes: [
    {
      tipo: "refeicao",
      preparo_id: "ovo-mexido",
      itens: [
        {
          alimento_id: "ovo",
          funcao: "proteina",
          contribui: [],
          linha_base: "alimentos:ovo",
        },
      ],
      motivo: "Ovo mexido morno, com o que a pessoa tem em casa.",
      linhas_base: ["preparos:ovo-mexido"],
      novidade: false,
    },
  ],
  evitar: [],
  incertos: [],
  citados: [],
}

const finalizar = (argumentos: unknown): PassoRoteirizado => ({
  texto: "Vou montar a resposta.",
  chamadas: [{ nome: "finalizar", argumentos }],
})

// Tudo que fica fora das mensagens: casa, gostos, faltas, lista e o perfil de "não como".
async function gravadoFora(deps: Awaited<ReturnType<typeof montar>>["deps"], contaId: string) {
  const perfil = await deps.stores.profiles.ler(contaId)
  return JSON.stringify({
    casa: await deps.stores.pantry.listar(contaId),
    gostos: await deps.stores.preferences.ler(contaId),
    faltas: await deps.stores.shortages.diasComFalta(contaId, "2000-01-01"),
    lista: await deps.stores.shortages.lista(contaId),
    perfil_nao_come: perfil.nao_come,
  })
}

// Resultado da última chamada de finalizar que o modelo recebeu (a recusa do passo anterior).
function resultadoDoFinalizarNas(
  mensagens: unknown[],
): { violacoes?: { codigo: string }[] } | undefined {
  const chamadas = mensagens.filter(
    (m): m is { papel: "tool"; nome: string; resultado: unknown } =>
      typeof m === "object" &&
      m !== null &&
      "papel" in m &&
      m.papel === "tool" &&
      "nome" in m &&
      m.nome === "finalizar",
  )
  return chamadas.at(-1)?.resultado as { violacoes?: { codigo: string }[] } | undefined
}

async function montar(c: CenarioDeConversa) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  return { contaId, deps, runtime }
}

describe("não como: a pergunta de come sai antes da entrega", () => {
  it("ask_user come pausa o run com a pergunta sobre o ovo", async () => {
    const c: CenarioDeConversa = { ...base, respostas: [], roteiro: [PERGUNTA_OVO] }
    const { contaId, deps } = await montar(c)

    const r = await deps.conversation.conversar(contaId, c.mensagem)

    expect(r.status).toBe("waiting_for_input")
    expect(r.pergunta).toMatchObject({ tipo: "come", alimento_id: "ovo" })
  })
})

describe("não como: a resposta vai para o filtro do checkpoint, não para o perfil", () => {
  it("depois de Não como, o ovo está em dados.filtro.nao_come e o perfil segue sem ele", async () => {
    const c: CenarioDeConversa = {
      ...base,
      respostas: [],
      roteiro: [PERGUNTA_OVO, PERGUNTA_CASA, finalizar(SEM_OVO)],
    }
    const { contaId, deps } = await montar(c)
    const perfilAntes = (await deps.stores.profiles.ler(contaId)).nao_come

    const primeira = await deps.conversation.conversar(contaId, c.mensagem)
    const segunda = await deps.conversation.continuar(contaId, primeira.run_id, {
      tipo: "come",
      resposta: "nao_como",
    })

    expect(segunda.status).toBe("waiting_for_input")
    expect(segunda.pergunta?.tipo).toBe("casa")
    const run = await deps.stores.runs.buscar(contaId, primeira.run_id)
    const dados = dadosDoPreparoSchema.parse((run?.checkpoint as { dados?: unknown } | null)?.dados)
    expect(dados.filtro.nao_come).toContain("ovo")
    expect((await deps.stores.profiles.ler(contaId)).nao_come).toEqual(perfilAntes)
    expect(JSON.stringify(await deps.stores.profiles.ler(contaId))).not.toContain("ovo")
  })
})

describe("não como: a entrega com ovo é recusada por nao_come", () => {
  it("finalizar com ovo recebe a violação nao_come e a entrega sem ovo passa", async () => {
    const c: CenarioDeConversa = {
      ...base,
      respostas: [{ tipo: "come", resposta: "nao_como" }, { tipo: "pular" }],
      roteiro: [PERGUNTA_OVO, PERGUNTA_CASA, finalizar(COM_OVO), finalizar(SEM_OVO)],
    }
    const { contaId, deps, runtime } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)

    const resultadoDoFinalizar = resultadoDoFinalizarNas(runtime.pedidos.at(-1)?.mensagens ?? [])
    expect(resultadoDoFinalizar?.violacoes).toContainEqual(
      expect.objectContaining({ codigo: "nao_come" }),
    )
    expect(rodada.final.status).toBe("done")
    expect(
      rodada.final.saida?.sugestoes.flatMap((s) => s.itens.map((i) => i.alimento_id)),
    ).not.toContain("ovo")
  })
})

describe("não como: a anotação nao_come sai na saída final", () => {
  it("a saída traz o ovo na anotação nao_come", async () => {
    const c: CenarioDeConversa = {
      ...base,
      respostas: [{ tipo: "come", resposta: "nao_como" }, { tipo: "pular" }],
      roteiro: [PERGUNTA_OVO, PERGUNTA_CASA, finalizar(SEM_OVO)],
    }
    const { contaId, deps } = await montar(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.final.status).toBe("done")
    expect(rodada.final.saida?.anotacoes).toContainEqual({
      tipo: "nao_come",
      itens: [{ alimento_id: "ovo", nome: "Ovo" }],
    })
  })
})

describe("como: a resposta Como não grava nada fora das mensagens", () => {
  it("Como deixa casa, gostos, faltas, lista e perfil como estavam, sem anotação nao_come", async () => {
    const c: CenarioDeConversa = {
      ...base,
      respostas: [{ tipo: "come", resposta: "como" }],
      roteiro: [PERGUNTA_OVO, finalizar(SEM_OVO)],
    }
    const { contaId, deps } = await montar(c)
    const antes = await gravadoFora(deps, contaId)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.final.status).toBe("done")
    expect(await gravadoFora(deps, contaId)).toBe(antes)
    const anotacoes = rodada.final.saida?.anotacoes ?? []
    expect(anotacoes.some((a) => a.tipo === "nao_come")).toBe(false)
  })
})
