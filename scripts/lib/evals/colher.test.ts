import { describe, expect, it } from "vitest"
import type { ResultadoDoRun } from "../../../evals/llm/casos/c1"
import type { SaidaDoAcompanhante } from "../../../src/core/agents/companion/saida"
import type { Run, RunEtapa } from "../../../src/core/runs/ports"
import {
  colhidoDoRun,
  conferir,
  contarEtapas,
  parteDoRun,
  retornosFalsos,
  usoDoRun,
  violacoesDaPrimeiraEntrega,
} from "./colher"

const AGORA = "2026-06-15T22:00:00.000Z"

const saidaDoAgente: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "Um prato morno, sem tela.",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
}

const etapa = (
  tipo: RunEtapa["tipo"],
  nome: string,
  ordem: number,
  status: RunEtapa["status"] = "ok",
): RunEtapa => ({
  run_id: "run-eval",
  ordem,
  tipo,
  nome,
  resumo: null,
  status,
  duracao_ms: 0,
  modelo: null,
  tokens_entrada: 0,
  tokens_saida: 0,
  criado_em: AGORA,
})

const run: Run = {
  id: "run-eval",
  conta_id: "conta-eval",
  caminho: "acompanhante",
  intencoes: [],
  status: "done",
  checkpoint: null,
  pendencia: null,
  momento: null,
  com_incomodo: false,
  clima_usado: null,
  saida: null,
  passos: 2,
  tokens_entrada: 120,
  tokens_saida: 45,
  latencia_ms: 900,
  modelos: { decisao: ["modelo-a"] },
  trocas_de_modelo: 0,
  prompt_versao: null,
  juiz_tentativas: 1,
  juiz_aprovado: true,
  trace_id: null,
  dia: "2026-06-15",
  criado_em: AGORA,
  atualizado_em: AGORA,
}

const resultado = (over: Partial<ResultadoDoRun> = {}): ResultadoDoRun => ({
  saida: saidaDoAgente,
  status: "done",
  tools: ["consultar.clima", "consultar.clima", "finalizar"],
  chamadasDeModelo: 2,
  validacoes: ["ok"],
  ...over,
})

describe("conferência de expectativas", () => {
  it("confere cada expectativa e devolve a lista, a descrição e o ok", () => {
    const expectativas = [
      { descricao: "entende o frio", confere: (r: { n: number }) => r.n > 0 },
      { descricao: "não fica vazio", confere: (r: { n: number }) => r.n < 5 },
    ]
    expect(conferir("deve", expectativas, { n: 3 })).toEqual([
      { lista: "deve", descricao: "entende o frio", ok: true },
      { lista: "deve", descricao: "não fica vazio", ok: true },
    ])
    expect(conferir("nao_pode", expectativas, { n: 9 })).toEqual([
      { lista: "nao_pode", descricao: "entende o frio", ok: true },
      { lista: "nao_pode", descricao: "não fica vazio", ok: false },
    ])
  })
})

describe("retornos falsos do Intérprete", () => {
  it("numera p1, p2 e marca como aguardando, sem alimentos", () => {
    const retornos = retornosFalsos(
      [
        { tipo: "cha", titulo: "Chá de gengibre" },
        { tipo: "oleo", titulo: "Óleo de gergelim" },
      ],
      AGORA,
    )
    expect(retornos.map((r) => r.id)).toEqual(["p1", "p2"])
    expect(retornos[0]?.status).toBe("aguardando")
    expect(retornos[1]?.sugestao).toEqual({
      tipo: "oleo",
      titulo: "Óleo de gergelim",
      alimentos: [],
    })
  })
})

describe("violações da primeira entrega", () => {
  const validacao = (n: number) => ({ nome: "validacao", atributos: { "validacao.violacoes": n } })
  const violacao = (codigo: string) => ({
    nome: "ritu_validacao_violacoes_total",
    rotulos: { violacao: codigo },
  })

  it("pega só as n primeiras métricas, onde n é do primeiro span validacao", () => {
    const spans = [{ nome: "interprete", atributos: {} }, validacao(2), validacao(1)]
    const metricas = [violacao("fora_da_base"), violacao("estrutura"), violacao("linha_base")]
    expect(violacoesDaPrimeiraEntrega(spans, metricas)).toEqual(["fora_da_base", "estrutura"])
  })

  it("sem violação na primeira, ou sem span de validação, dá lista vazia", () => {
    expect(violacoesDaPrimeiraEntrega([validacao(0)], [violacao("x")])).toEqual([])
    expect(violacoesDaPrimeiraEntrega([], [violacao("x")])).toEqual([])
  })
})

describe("contagem de recusas e de chamadas antes da pausa", () => {
  it("conta as recusas de ask_user e as chamadas de modelo antes da primeira pergunta", () => {
    const etapas = [
      etapa("llm", "decisao", 1),
      etapa("pergunta", "casa", 2),
      etapa("llm", "decisao", 3),
      etapa("validacao", "ask_user", 4, "recusado"),
      etapa("llm", "decisao", 5),
    ]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 1,
      llmAntesDaPrimeiraPausa: 1,
      propostasRecusadas: 0,
    })
  })

  it("sem pausa, conta todas as chamadas de modelo", () => {
    const etapas = [etapa("llm", "decisao", 1), etapa("llm", "decisao", 2)]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 0,
      llmAntesDaPrimeiraPausa: 2,
      propostasRecusadas: 0,
    })
  })

  it("só ask_user recusado conta; outra tool recusada e ask_user aceito não", () => {
    const etapas = [
      etapa("validacao", "finalizar", 1, "recusado"),
      etapa("validacao", "ask_user", 2, "ok"),
    ]
    expect(contarEtapas(etapas)).toEqual({
      recusadas: 0,
      llmAntesDaPrimeiraPausa: 0,
      propostasRecusadas: 0,
    })
  })

  it("conta as propostas recusadas pelo código: tool de proposta com resumo recusado:", () => {
    const comResumo = (e: RunEtapa, resumo: string | null): RunEtapa => ({ ...e, resumo })
    const etapas = [
      comResumo(etapa("tool", "memoria.propor", 1), "recusado: conteudo_invalido"),
      comResumo(etapa("tool", "lista.propor", 2), "recusado: fora_da_lista"),
      comResumo(etapa("tool", "lista.propor", 3), "proposto"),
      comResumo(etapa("tool", "finalizar", 4), "recusado: validacao"),
      comResumo(etapa("tool", "memoria.propor", 5), null),
    ]
    expect(contarEtapas(etapas).propostasRecusadas).toBe(2)
  })
})

describe("parteDoRun", () => {
  const contagem = { recusadas: 1, llmAntesDaPrimeiraPausa: 0, propostasRecusadas: 2 }

  it("sem trajetória: trajetoriaOk é null e as chamadas desnecessárias são 0", () => {
    const parte = parteDoRun({
      r: resultado(),
      run,
      violacoes: [],
      perguntasFeitas: 0,
      contagem,
    })
    expect(parte).toEqual({
      origem: "agente",
      caminho: undefined,
      trajetoriaOk: null,
      chamadasDesnecessarias: 0,
      passos: 2,
      validacoes: ["ok"],
      violacoesDa1a: [],
      perguntasFeitas: 0,
      perguntasRecusadas: 1,
      propostasRecusadas: 2,
      juizAprovado: true,
    })
  })

  it("com trajetória: confere o ok e conta as chamadas proibidas e repetidas", () => {
    const parte = parteDoRun({
      r: resultado(),
      run,
      caminho: "acompanhante",
      trajetoria: { chamadas: ["consultar.clima"], proibidas: ["finalizar"] },
      violacoes: ["estrutura"],
      perguntasFeitas: 1,
      contagem,
    })
    expect(parte.trajetoriaOk).toBe(false)
    expect(parte.chamadasDesnecessarias).toBe(2)
    expect(parte.caminho).toBe("acompanhante")
    expect(parte.violacoesDa1a).toEqual(["estrutura"])
    expect(parte.perguntasFeitas).toBe(1)
  })

  it("leva o recusado da primeira validação", () => {
    const parte = parteDoRun({
      r: resultado({ validacoes: ["recusado", "ok"] }),
      run: { ...run, juiz_aprovado: null },
      violacoes: ["fora_da_base"],
      perguntasFeitas: 0,
      contagem,
    })
    expect(parte.validacoes).toEqual(["recusado", "ok"])
    expect(parte.juizAprovado).toBeNull()
  })
})

describe("usoDoRun", () => {
  it("põe as chamadas e os tokens do run no papel decisao", () => {
    expect(usoDoRun(run, resultado())).toEqual({
      decisao: { chamadas: 2, tokens_entrada: 120, tokens_saida: 45 },
    })
  })
})

describe("colhidoDoRun", () => {
  it("leva a resposta, a saída e as etapas com tipo, nome, status e resumo", () => {
    const etapas = [{ ...etapa("tool", "finalizar", 1), resumo: "proposto" }]
    const colhido = colhidoDoRun("Estou com frio", saidaDoAgente, etapas)
    expect(colhido).toEqual({
      mensagem: "Estou com frio",
      texto: "Um prato morno, sem tela.",
      saida: saidaDoAgente,
      etapas: [{ tipo: "tool", nome: "finalizar", status: "ok", resumo: "proposto" }],
    })
  })

  it("sem mensagem, o campo fica fora do resultado", () => {
    const colhido = colhidoDoRun(undefined, saidaDoAgente, [])
    expect(colhido.mensagem).toBeUndefined()
    expect(colhido.etapas).toEqual([])
  })
})
