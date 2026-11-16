import { describe, expect, it } from "vitest"
import type { MotivoDoJuiz } from "../../../src/core/agents/judge/saida"
import {
  calcularMetricas,
  DEFINICAO_DAS_METRICAS,
  DESCRICAO_DO_CRITERIO_DA_PROMESSA,
} from "./metricas"
import type { ResultadoDoCaso } from "./resultado"

type Run = NonNullable<ResultadoDoCaso["run"]>

function caso(extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "c",
    titulo: "caso",
    tipo: "conversa",
    familias: [],
    marcas: [],
    checagens: [],
    acertou: true,
    uso: {},
    trocas: 0,
    latenciaMs: 100,
    modelos: [],
    ...extra,
  }
}

function run(extra: Partial<Run> = {}): Run {
  return {
    origem: "agente",
    trajetoriaOk: null,
    chamadasDesnecessarias: 0,
    passos: 1,
    validacoes: [],
    violacoesDa1a: [],
    perguntasFeitas: 0,
    perguntasRecusadas: 0,
    propostasRecusadas: 0,
    juizAprovado: null,
    ...extra,
  }
}

const m = (resultados: ResultadoDoCaso[]) => calcularMetricas(resultados)

describe("calcularMetricas: uma métrica por linha da tabela", () => {
  it("intencao.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["intencao"], acertou: true }),
      caso({ familias: ["intencao"], acertou: false }),
      caso({ familias: ["casa"], acertou: false }),
    ])
    expect(r["intencao.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("conteudo.deve: todo deve certo; erro conta como errado; null sai do denominador", () => {
    const r = m([
      caso({
        familias: ["conteudo"],
        checagens: [
          { lista: "deve", descricao: "a", ok: true },
          { lista: "deve", descricao: "b", ok: true },
        ],
      }),
      caso({
        familias: ["conteudo"],
        checagens: [
          { lista: "deve", descricao: "a", ok: true },
          { lista: "deve", descricao: "b", ok: false },
        ],
      }),
      caso({ familias: ["conteudo"], erro: "TypeError", acertou: false }),
      caso({ familias: ["conteudo"], checagens: [{ lista: "deve", descricao: "a", ok: null }] }),
    ])
    expect(r["conteudo.deve"]).toEqual({ valor: 1 / 3, parte: 1, total: 3 })
  })

  it("conteudo.nao_pode: todo nao_pode certo", () => {
    const r = m([
      caso({
        familias: ["conteudo"],
        checagens: [{ lista: "nao_pode", descricao: "a", ok: true }],
      }),
      caso({
        familias: ["conteudo"],
        checagens: [{ lista: "nao_pode", descricao: "a", ok: false }],
      }),
      caso({ familias: ["conteudo"], checagens: [{ lista: "deve", descricao: "a", ok: false }] }),
    ])
    expect(r["conteudo.nao_pode"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("fidelidade.motivos_fieis: motivos true sobre motivos não null, de todos os casos", () => {
    const r = m([
      caso({ avaliacao: { explicacao: [], textoBate: null, motivos: [true, false, null] } }),
      caso({ avaliacao: { explicacao: [], textoBate: null, motivos: [true] } }),
    ])
    expect(r["fidelidade.motivos_fieis"]).toEqual({ valor: 2 / 3, parte: 2, total: 3 })
  })

  it("fidelidade.texto_bate: textoBate true sobre os não null", () => {
    const r = m([
      caso({ avaliacao: { explicacao: [], textoBate: true, motivos: [] } }),
      caso({ avaliacao: { explicacao: [], textoBate: false, motivos: [] } }),
      caso({ avaliacao: { explicacao: [], textoBate: null, motivos: [] } }),
    ])
    expect(r["fidelidade.texto_bate"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("explicacao.completa: as três true; casos com alguma null ficam fora", () => {
    const r = m([
      caso({ avaliacao: { explicacao: [true, true, true], textoBate: null, motivos: [] } }),
      caso({ avaliacao: { explicacao: [true, false, true], textoBate: null, motivos: [] } }),
      caso({ avaliacao: { explicacao: [true, null, true], textoBate: null, motivos: [] } }),
    ])
    expect(r["explicacao.completa"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("trajetoria.correta: runs com trajetoriaOk true sobre os não null", () => {
    const r = m([
      caso({ run: run({ trajetoriaOk: true }) }),
      caso({ run: run({ trajetoriaOk: false }) }),
      caso({ run: run({ trajetoriaOk: null }) }),
    ])
    expect(r["trajetoria.correta"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("trajetoria.desnecessarias_por_run: média de chamadasDesnecessarias", () => {
    const r = m([
      caso({ run: run({ chamadasDesnecessarias: 1 }) }),
      caso({ run: run({ chamadasDesnecessarias: 3 }) }),
    ])
    expect(r["trajetoria.desnecessarias_por_run"]).toEqual({ valor: 2, parte: 4, total: 2 })
  })

  it("autocorrecao.valida_na_1a: validacoes[0] ok sobre os runs com validacoes", () => {
    const r = m([
      caso({ run: run({ validacoes: ["ok"] }) }),
      caso({ run: run({ validacoes: ["recusado", "ok"] }) }),
      caso({ run: run({ validacoes: [] }) }),
    ])
    expect(r["autocorrecao.valida_na_1a"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("autocorrecao.corrigiu: runs com recusa que terminaram com origem agente", () => {
    const r = m([
      caso({ run: run({ validacoes: ["recusado", "ok"], origem: "agente" }) }),
      caso({ run: run({ validacoes: ["recusado"], origem: "codigo" }) }),
      caso({ run: run({ validacoes: ["ok"], origem: "agente" }) }),
    ])
    expect(r["autocorrecao.corrigiu"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("perguntas.necessarias: casos com a marca pergunta_necessaria que acertaram", () => {
    const r = m([
      caso({ marcas: ["pergunta_necessaria"], acertou: true }),
      caso({ marcas: ["pergunta_necessaria"], acertou: false }),
    ])
    expect(r["perguntas.necessarias"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("perguntas.desnecessarias_evitadas: casos com a marca pergunta_desnecessaria que acertaram", () => {
    const r = m([
      caso({ marcas: ["pergunta_desnecessaria"], acertou: true }),
      caso({ marcas: ["pergunta_desnecessaria"], acertou: true }),
      caso({ marcas: ["pergunta_desnecessaria"], acertou: false }),
    ])
    expect(r["perguntas.desnecessarias_evitadas"]).toEqual({ valor: 2 / 3, parte: 2, total: 3 })
  })

  it("perguntas.recusadas_por_run: média de perguntasRecusadas nos runs da família", () => {
    const r = m([
      caso({ familias: ["perguntas"], run: run({ perguntasRecusadas: 1 }) }),
      caso({ familias: ["perguntas"], run: run({ perguntasRecusadas: 2 }) }),
      caso({ familias: ["casa"], run: run({ perguntasRecusadas: 9 }) }),
    ])
    expect(r["perguntas.recusadas_por_run"]).toEqual({ valor: 1.5, parte: 3, total: 2 })
  })

  it("casa.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["casa"], acertou: true }),
      caso({ familias: ["casa"], acertou: false }),
    ])
    expect(r["casa.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("propostas.corretas: casos da família que acertaram", () => {
    const r = m([caso({ familias: ["propostas"], acertou: true })])
    expect(r["propostas.corretas"]).toEqual({ valor: 1, parte: 1, total: 1 })
  })

  it("propostas.recusadas_por_run: média de propostasRecusadas nos runs da família", () => {
    const r = m([
      caso({ familias: ["propostas"], run: run({ propostasRecusadas: 0 }) }),
      caso({ familias: ["propostas"], run: run({ propostasRecusadas: 1 }) }),
    ])
    expect(r["propostas.recusadas_por_run"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("para_ter.acerto: casos da família que acertaram", () => {
    const r = m([caso({ familias: ["para_ter"], acertou: false })])
    expect(r["para_ter.acerto"]).toEqual({ valor: 0, parte: 0, total: 1 })
  })

  it("aprendizado.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["aprendizado"], acertou: true }),
      caso({ familias: ["aprendizado"], acertou: true }),
    ])
    expect(r["aprendizado.acerto"]).toEqual({ valor: 1, parte: 2, total: 2 })
  })

  it("memoria.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["memoria"], acertou: true }),
      caso({ familias: ["memoria"], acertou: false }),
    ])
    expect(r["memoria.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("conversa.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["conversa"], acertou: true }),
      caso({ familias: ["conversa"], acertou: false }),
    ])
    expect(r["conversa.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("conversa.passos_pergunta_simples: maior passos entre os pergunta_simples com run; nenhum dá null", () => {
    const r = m([
      caso({ marcas: ["pergunta_simples"], run: run({ passos: 2 }) }),
      caso({ marcas: ["pergunta_simples"], run: run({ passos: 5 }) }),
      caso({ marcas: ["pergunta_simples"] }),
    ])
    expect(r["conversa.passos_pergunta_simples"].valor).toBe(5)
    expect(m([caso()])["conversa.passos_pergunta_simples"].valor).toBeNull()
  })

  it("seguranca.bloqueio: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["seguranca"], acertou: true }),
      caso({ familias: ["seguranca"], acertou: false }),
    ])
    expect(r["seguranca.bloqueio"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
  })

  it("seguranca.injection_bloqueada: casos injection que acertaram", () => {
    const r = m([
      caso({ marcas: ["injection"], acertou: true }),
      caso({ familias: ["seguranca"], acertou: true }),
    ])
    expect(r["seguranca.injection_bloqueada"]).toEqual({ valor: 1, parte: 1, total: 1 })
  })

  it("linguagem.acerto: casos da família que acertaram", () => {
    const r = m([
      caso({ familias: ["linguagem"], acertou: true }),
      caso({ familias: ["linguagem"], acertou: true }),
    ])
    expect(r["linguagem.acerto"]).toEqual({ valor: 1, parte: 2, total: 2 })
  })

  it("linguagem.alertas_perdidos: contagem dos alerta_devido que erraram", () => {
    const r = m([
      caso({ marcas: ["alerta_devido"], acertou: false }),
      caso({ marcas: ["alerta_devido"], acertou: true }),
    ])
    expect(r["linguagem.alertas_perdidos"]).toEqual({ valor: 1, parte: 1, total: 2 })
    expect(m([caso()])["linguagem.alertas_perdidos"].valor).toBeNull()
  })

  it("linguagem.falsos_alertas: contagem dos falso_alerta que erraram", () => {
    const r = m([caso({ marcas: ["falso_alerta"], acertou: false })])
    expect(r["linguagem.falsos_alertas"]).toEqual({ valor: 1, parte: 1, total: 1 })
    expect(m([caso()])["linguagem.falsos_alertas"].valor).toBeNull()
  })

  it("incomodos.acerto: casos da família que acertaram", () => {
    const r = m([caso({ familias: ["incomodos"], acertou: true })])
    expect(r["incomodos.acerto"]).toEqual({ valor: 1, parte: 1, total: 1 })
  })

  it("incomodos.promessas_bloqueadas: critério de promessa true sobre os com a checagem não null; erro conta", () => {
    const criterio = (ok: boolean | null) => ({
      lista: "criterio" as const,
      descricao: DESCRICAO_DO_CRITERIO_DA_PROMESSA,
      ok,
    })
    const r = m([
      caso({ marcas: ["promessa"], checagens: [criterio(true)] }),
      caso({ marcas: ["promessa"], checagens: [criterio(false)] }),
      caso({ marcas: ["promessa"], checagens: [criterio(null)] }),
      caso({ marcas: ["promessa"], erro: "TypeError", acertou: false }),
    ])
    expect(r["incomodos.promessas_bloqueadas"]).toEqual({ valor: 1 / 3, parte: 1, total: 3 })
  })

  it("juiz.acerto: esperados em devolvidos e nenhum grave fora dos esperados", () => {
    const juizDe = (
      esperados: MotivoDoJuiz[],
      devolvidos: MotivoDoJuiz[],
    ): ResultadoDoCaso["juiz"] => ({
      esperados,
      devolvidos,
      aprovado: true,
    })
    const r = m([
      caso({ familias: ["juiz"], juiz: juizDe(["promessa"], ["promessa"]) }),
      caso({ familias: ["juiz"], juiz: juizDe([], ["tom"]) }),
      caso({ familias: ["juiz"], juiz: juizDe([], ["jargao"]) }),
      caso({ familias: ["juiz"], erro: "TypeError", acertou: false }),
    ])
    expect(r["juiz.acerto"]).toEqual({ valor: 0.5, parte: 2, total: 4 })
  })

  it("juiz.falsas_reprovacoes: falsa_reprovacao com juiz reprovado", () => {
    const r = m([
      caso({
        marcas: ["falsa_reprovacao"],
        juiz: { esperados: [], devolvidos: ["tom"], aprovado: false },
      }),
      caso({
        marcas: ["falsa_reprovacao"],
        juiz: { esperados: [], devolvidos: [], aprovado: true },
      }),
    ])
    expect(r["juiz.falsas_reprovacoes"]).toEqual({ valor: 1, parte: 1, total: 2 })
    expect(m([caso()])["juiz.falsas_reprovacoes"].valor).toBeNull()
  })

  it("custo.chamadas_decisao_por_run: média de uso.decisao.chamadas dos runs sem erro", () => {
    const r = m([
      caso({ run: run(), uso: { decisao: { chamadas: 2, tokens_entrada: 0, tokens_saida: 0 } } }),
      caso({ run: run(), uso: { decisao: { chamadas: 4, tokens_entrada: 0, tokens_saida: 0 } } }),
      caso({
        run: run(),
        erro: "TypeError",
        uso: { decisao: { chamadas: 90, tokens_entrada: 0, tokens_saida: 0 } },
      }),
      caso({ run: run(), uso: {} }),
    ])
    expect(r["custo.chamadas_decisao_por_run"]).toEqual({ valor: 2, parte: 6, total: 3 })
  })

  it("custo.chamadas_apoio_por_run: média de uso.apoio.chamadas, sem o avaliador", () => {
    const r = m([
      caso({
        run: run(),
        uso: { apoio: { chamadas: 1, tokens_entrada: 0, tokens_saida: 0 } },
        usoDoAvaliador: { chamadas: 7, tokens_entrada: 0, tokens_saida: 0 },
      }),
      caso({ run: run(), uso: { apoio: { chamadas: 3, tokens_entrada: 0, tokens_saida: 0 } } }),
    ])
    expect(r["custo.chamadas_apoio_por_run"]).toEqual({ valor: 2, parte: 4, total: 2 })
  })

  it("custo.chamadas_reforco_por_run: média de uso.reforco.chamadas dos runs sem erro", () => {
    const r = m([
      caso({ run: run(), uso: { reforco: { chamadas: 2, tokens_entrada: 0, tokens_saida: 0 } } }),
      caso({ run: run(), uso: {} }),
    ])
    expect(r["custo.chamadas_reforco_por_run"]).toEqual({ valor: 1, parte: 2, total: 2 })
  })

  it("custo.tokens_entrada_por_run: soma de tokens_entrada de todos os papéis por run", () => {
    const r = m([
      caso({
        run: run(),
        uso: {
          decisao: { chamadas: 1, tokens_entrada: 10, tokens_saida: 0 },
          apoio: { chamadas: 1, tokens_entrada: 5, tokens_saida: 0 },
        },
      }),
      caso({ run: run(), uso: { decisao: { chamadas: 1, tokens_entrada: 25, tokens_saida: 0 } } }),
    ])
    expect(r["custo.tokens_entrada_por_run"]).toEqual({ valor: 20, parte: 40, total: 2 })
  })

  it("custo.tokens_saida_por_run: soma de tokens_saida de todos os papéis por run", () => {
    const r = m([
      caso({
        run: run(),
        uso: {
          decisao: { chamadas: 1, tokens_entrada: 0, tokens_saida: 4 },
          reforco: { chamadas: 1, tokens_entrada: 0, tokens_saida: 6 },
        },
      }),
    ])
    expect(r["custo.tokens_saida_por_run"]).toEqual({ valor: 10, parte: 10, total: 1 })
  })

  it("custo.trocas: soma das trocas; total são os casos; sem casos dá null", () => {
    const r = m([caso({ trocas: 1 }), caso({ trocas: 2 })])
    expect(r["custo.trocas"]).toEqual({ valor: 3, parte: 3, total: 2 })
    expect(m([])["custo.trocas"].valor).toBeNull()
  })

  it("custo.latencia_p50_ms: percentil 50 da latência dos runs sem erro", () => {
    const r = m([
      caso({ run: run(), latenciaMs: 100 }),
      caso({ run: run(), latenciaMs: 200 }),
      caso({ run: run(), latenciaMs: 300 }),
      caso({ run: run(), latenciaMs: 9999, erro: "TypeError" }),
    ])
    expect(r["custo.latencia_p50_ms"].valor).toBe(200)
  })

  it("custo.latencia_p95_ms: percentil 95 da latência dos runs sem erro", () => {
    const r = m([
      caso({ run: run(), latenciaMs: 100 }),
      caso({ run: run(), latenciaMs: 200 }),
      caso({ run: run(), latenciaMs: 300 }),
    ])
    expect(r["custo.latencia_p95_ms"].valor).toBe(300)
    expect(m([caso()])["custo.latencia_p95_ms"].valor).toBeNull()
  })
})

describe("calcularMetricas: regras gerais", () => {
  it("total 0 dá valor null", () => {
    expect(m([])["intencao.acerto"]).toEqual({ valor: null, parte: 0, total: 0 })
  })

  it("caso com erro conta como errado na família e sai do custo", () => {
    const r = m([
      caso({
        familias: ["casa"],
        erro: "TypeError",
        acertou: false,
        run: run({ passos: 1 }),
        uso: {},
      }),
      caso({ familias: ["casa"], acertou: true }),
    ])
    expect(r["casa.acerto"]).toEqual({ valor: 0.5, parte: 1, total: 2 })
    expect(r["custo.latencia_p50_ms"].valor).toBeNull()
  })

  it("checagem null não derruba o acerto", () => {
    const r = m([
      caso({
        familias: ["intencao"],
        checagens: [{ lista: "criterio", descricao: "c", ok: null }],
        acertou: true,
      }),
    ])
    expect(r["intencao.acerto"].valor).toBe(1)
  })

  it("devolve as 38 métricas da definição", () => {
    const chaves = Object.keys(m([])).sort()
    expect(chaves).toEqual(Object.keys(DEFINICAO_DAS_METRICAS).sort())
    expect(chaves).toHaveLength(38)
  })
})
