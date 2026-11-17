import { describe, expect, it } from "vitest"
import type { ConversaDoDia } from "@/core/conversation/do-dia"
import type { VisaoDoRun } from "@/core/conversation/visao"
import { inicial, reduzir, textoOtimista } from "./estado"

function visao(run_id: string, extra: Partial<VisaoDoRun> = {}): VisaoDoRun {
  return {
    run_id,
    status: "completed",
    caminho: "acompanhante",
    frases: [],
    avisos: [],
    sugestoes: [],
    evitar: [],
    geral: false,
    podeVotar: true,
    ...extra,
  } as VisaoDoRun
}

const vazia: ConversaDoDia = {
  falas: [],
  runs: {},
  pendentes: 1,
  limites: { mensagens: { tipo: "livre" }, cota_ia: { esgotada: false } },
}

function enviado() {
  return reduzir(
    { ...inicial(vazia), caixa: { texto: "oi", atalhos: ["com_frio"], respondendo: false } },
    { tipo: "enviou", texto: "oi", mensagem: { texto: "oi", atalhos: ["com_frio"] } },
  )
}

describe("estado da conversa", () => {
  it("inicial usa a mensagem sugerida na caixa, quando há", () => {
    expect(inicial(vazia).caixa).toEqual({ texto: "", atalhos: [], respondendo: false })
    expect(inicial({ ...vazia, mensagem_sugerida: "Oi" }).caixa.texto).toBe("Oi")
  })

  it("envio otimista põe a fala da pessoa e a caixa respondendo", () => {
    const e = enviado()
    expect(e.falas.at(-1)).toMatchObject({ autor: "pessoa", texto: "oi", run_id: null })
    expect(e.caixa.respondendo).toBe(true)
  })

  it("monta o texto otimista com os rótulos dos atalhos", () => {
    expect(textoOtimista({ texto: "oi", atalhos: ["a"] }, { a: "🥶 Com frio" })).toBe(
      "🥶 Com frio\noi",
    )
  })

  it("etapas não repetem a chave anterior", () => {
    let e = reduzir(enviado(), { tipo: "evento", evento: { tipo: "inicio", run_id: "r1" } })
    const f = { chave: "clima", texto: "Olhando o clima" }
    e = reduzir(e, { tipo: "evento", evento: { tipo: "etapa", frase: f } })
    e = reduzir(e, { tipo: "evento", evento: { tipo: "etapa", frase: f } })
    expect(e.aoVivo?.frases).toEqual([f])
    expect(e.aoVivo?.run_id).toBe("r1")
  })

  it("ignora etapa sem chave", () => {
    const e = enviado()
    const r = reduzir(e, {
      tipo: "evento",
      evento: { tipo: "etapa", frase: {} as never },
    })
    expect(r).toBe(e)
  })

  it("fim limpa a caixa, desmarca atalhos e anuncia a resposta", () => {
    let e = reduzir(enviado(), { tipo: "evento", evento: { tipo: "inicio", run_id: "r1" } })
    e = reduzir(e, {
      tipo: "evento",
      evento: {
        tipo: "fim",
        visao: visao("r1", { resposta: "Um chá." }),
        pendentes: 3,
        limites: { mensagens: { tipo: "livre" }, cota_ia: { esgotada: false } },
      },
    })
    expect(e.caixa).toEqual({ texto: "", atalhos: [], respondendo: false })
    expect(e.anuncio).toBe("Um chá.")
    expect(e.pendentes).toBe(3)
    expect(e.aoVivo).toBeUndefined()
    expect(e.falas.at(-1)).toMatchObject({ autor: "agente", texto: "Um chá.", run_id: "r1" })
    expect(e.runs.r1?.run_id).toBe("r1")
    const de = reduzir(e, {
      tipo: "visao",
      visao: visao("r1", { resposta: "Um chá.", voto: "up" }),
    })
    expect(de.falas.filter((f) => f.autor === "agente")).toHaveLength(1)
    expect(de.anuncio).toBe("Um chá.")
  })

  it("consulta que acha o run fora de running fecha o envio como um fim", () => {
    let e = reduzir(enviado(), { tipo: "evento", evento: { tipo: "inicio", run_id: "r1" } })
    e = reduzir(e, { tipo: "visao", visao: visao("r1", { status: "running" }) })
    expect(e.caixa.respondendo).toBe(true)
    e = reduzir(e, { tipo: "visao", visao: visao("r1", { resposta: "Um chá." }), pendentes: 2 })
    expect(e.caixa).toEqual({ texto: "", atalhos: [], respondendo: false })
    expect(e.aoVivo).toBeUndefined()
    expect(e.enviado).toBeUndefined()
    expect(e.anuncio).toBe("Um chá.")
    expect(e.pendentes).toBe(2)
    expect(e.aberto).toBeUndefined()
  })

  it("fim sem visão válida vira erro inesperado, sem quebrar", () => {
    const e = reduzir(enviado(), {
      tipo: "evento",
      evento: {
        tipo: "fim",
        visao: undefined as never,
        pendentes: 0,
        limites: { mensagens: { tipo: "livre" }, cota_ia: { esgotada: false } },
      },
    })
    expect(e.erro?.codigo).toBe("inesperado")
  })

  it("falhou devolve texto e atalhos à caixa e tira a fala otimista", () => {
    const e = reduzir(enviado(), { tipo: "falhou" })
    expect(e.erro).toEqual({ codigo: "rede", texto: "oi", atalhos: ["com_frio"] })
    expect(e.caixa).toEqual({ texto: "oi", atalhos: ["com_frio"], respondendo: false })
    expect(e.falas).toHaveLength(0)
  })

  it("erro run_aberto guarda o código", () => {
    const e = reduzir(enviado(), { tipo: "evento", evento: { tipo: "erro", erro: "run_aberto" } })
    expect(e.erro?.codigo).toBe("run_aberto")
    expect(e.caixa.respondendo).toBe(false)
    expect(e.caixa.texto).toBe("oi")
  })

  it("visao substitui só o run certo", () => {
    const base = inicial({
      ...vazia,
      runs: { a: visao("a"), b: visao("b") },
    })
    const e = reduzir(base, { tipo: "visao", visao: visao("a", { voto: "down" }) })
    expect(e.runs.a?.voto).toBe("down")
    expect(e.runs.b).toBe(base.runs.b)
  })

  it("digitou e marcou mexem só na caixa", () => {
    let e = reduzir(inicial(vazia), { tipo: "digitou", texto: "x" })
    e = reduzir(e, { tipo: "marcou", atalhos: ["seca"] })
    expect(e.caixa).toEqual({ texto: "x", atalhos: ["seca"], respondendo: false })
  })
})
