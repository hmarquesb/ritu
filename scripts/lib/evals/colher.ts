// Ajudantes do eval com LLM que leem um run: conferir as expectativas, colher o resultado, medir a trajetória
// e montar a parte `run` do resultado de um caso. Sem container: as dependências entram por parâmetro.
import { z } from "zod"
import type { Papel } from "../../../config/llm-cotas"
import type { ResultadoDoRun, Trajetoria } from "../../../evals/llm/casos/c1"
import type { CasoConversa } from "../../../evals/llm/casos/c2"
import type { SaidaDoAcompanhante } from "../../../src/core/agents/companion/saida"
import type { CodigoDeViolacao } from "../../../src/core/agents/companion/validador"
import type { SugestaoRegistrada } from "../../../src/core/memory-schemas"
import type { Retorno } from "../../../src/core/outcomes/ports"
import type { Pergunta, RespostaDaPessoa } from "../../../src/core/runs/pergunta"
import type { Caminho, Run, RunEtapa } from "../../../src/core/runs/ports"
import { MAXIMO_DE_RETOMADAS } from "../../../test/fixtures/cenarios/rodar"
import type { Checagem, Colhido, ResultadoDoCaso, UsoDoPapel } from "./resultado"

const CONTA_FALSA = "conta-eval"
const RUN_FALSO = "run-eval"

/** Confere cada expectativa do caso contra `alvo` e devolve as checagens na ordem da lista. */
export function conferir<T>(
  lista: "deve" | "nao_pode",
  expectativas: { descricao: string; confere: (r: T) => boolean }[],
  alvo: T,
): Checagem[] {
  return expectativas.map((e) => ({ lista, descricao: e.descricao, ok: e.confere(alvo) }))
}

/** Os pendentes do caso viram Retornos falsos, numerados p1, p2, … como o Intérprete espera. */
export function retornosFalsos(
  pendentes: { tipo: SugestaoRegistrada["tipo"]; titulo: string }[],
  agora: string,
): Retorno[] {
  return pendentes.map((p, i) => ({
    id: `p${i + 1}`,
    conta_id: CONTA_FALSA,
    run_id: RUN_FALSO,
    sugestao: { tipo: p.tipo, titulo: p.titulo, alimentos: [] },
    status: "aguardando",
    resultado: null,
    origem: null,
    criado_em: agora,
    respondido_em: null,
  }))
}

type SpanVisto = { nome: string; atributos: Record<string, unknown> }
type MetricaVista = { nome: string; rotulos: Record<string, unknown> }

/** Violações da primeira entrega: as n primeiras métricas, n = validacao.violacoes do primeiro span validacao. */
export function violacoesDaPrimeiraEntrega(spans: SpanVisto[], metricas: MetricaVista[]): string[] {
  const primeira = spans.find((s) => s.nome === "validacao")
  const n = Number(primeira?.atributos["validacao.violacoes"] ?? 0)
  return metricas
    .filter((m) => m.nome === "ritu_validacao_violacoes_total")
    .slice(0, n)
    .map((m) => String(m.rotulos.violacao))
}

const repetidas = (tools: string[]): number => tools.length - new Set(tools).size

export function colherResultado(
  saida: SaidaDoAcompanhante,
  status: Run["status"],
  etapas: RunEtapa[],
): ResultadoDoRun {
  return {
    saida,
    status,
    tools: etapas.filter((e) => e.tipo === "tool").map((e) => e.nome),
    chamadasDeModelo: etapas.filter((e) => e.tipo === "llm").length,
    validacoes: etapas.filter((e) => e.tipo === "validacao").map((e) => e.status),
  }
}

export function trajetoria(
  t: Trajetoria | undefined,
  r: ResultadoDoRun,
): { ok: boolean; desnecessarias: number } {
  const proibidas = r.tools.filter((n) => t?.proibidas?.includes(n)).length
  const faltou = (t?.chamadas ?? []).some((n) => !r.tools.includes(n))
  const passou = t?.maxChamadasDeModelo !== undefined && r.chamadasDeModelo > t.maxChamadasDeModelo
  return {
    ok: !faltou && proibidas === 0 && !passou,
    desnecessarias: proibidas + repetidas(r.tools),
  }
}

const modelosSchema = z.object({ decisao: z.array(z.string()).optional() })

export function modelosDoRun(modelos: unknown): string[] {
  const lidos = modelosSchema.safeParse(modelos)
  return lidos.success ? (lidos.data.decisao ?? []) : []
}

export type ContagemDasEtapas = {
  recusadas: number
  llmAntesDaPrimeiraPausa: number
  propostasRecusadas: number
}

const FERRAMENTAS_DE_PROPOSTA = ["memoria.propor", "lista.propor"]

/** Recusas de ask_user e chamadas de modelo antes da primeira pergunta; sem pergunta, todas as chamadas. */
export function contarEtapas(etapas: RunEtapa[]): ContagemDasEtapas {
  const recusadas = etapas.filter(
    (e) => e.tipo === "validacao" && e.nome === "ask_user" && e.status === "recusado",
  ).length
  const ordensDasPerguntas = etapas.filter((e) => e.tipo === "pergunta").map((e) => e.ordem)
  const corte =
    ordensDasPerguntas.length > 0 ? Math.min(...ordensDasPerguntas) : Number.POSITIVE_INFINITY
  const llmAntesDaPrimeiraPausa = etapas.filter((e) => e.tipo === "llm" && e.ordem < corte).length
  const propostasRecusadas = etapas.filter(
    (e) =>
      e.tipo === "tool" &&
      FERRAMENTAS_DE_PROPOSTA.includes(e.nome) &&
      (e.resumo ?? "").startsWith("recusado:"),
  ).length
  return { recusadas, llmAntesDaPrimeiraPausa, propostasRecusadas }
}

/**
 * Cenário que o runner da conversa roda, sem a decisão do bloco de aprovação (D18) e sem toques (D14).
 * Com `aprovacao` o runner aprovaria; sem ela o bloco fica aberto e o caso termina em waiting_for_approval.
 * Os toques são da pessoa na tela: o runner nunca toca.
 */
export function cenarioDoRunner<C extends { aprovacao?: unknown; toques?: unknown }>(
  cenario: C,
): Omit<C, "aprovacao" | "toques"> {
  const { aprovacao: _decisao, toques: _toques, ...resto } = cenario
  return resto
}

/** Resposta de uma pausa: a função recebe a pergunta que saiu; posição vazia vira pular. */
export function resolverResposta(
  resposta: NonNullable<CasoConversa["respostas"]>[number] | undefined,
  pergunta: Pergunta,
): RespostaDaPessoa {
  if (typeof resposta === "function") return resposta(pergunta)
  return resposta ?? { tipo: "pular" }
}

export const MOTIVO_PAUSA_ACIMA_DO_TETO = `pausou mais de ${MAXIMO_DE_RETOMADAS} vezes`

/** A parte `run` do resultado de um caso: o que o run fez, a trajetória, as recusas e a aprovação do juiz. */
export function parteDoRun(p: {
  r: ResultadoDoRun
  run: Run
  caminho?: Caminho
  trajetoria?: Trajetoria
  violacoes: string[]
  perguntasFeitas: number
  contagem: ContagemDasEtapas
}): NonNullable<ResultadoDoCaso["run"]> {
  const traj = p.trajetoria === undefined ? undefined : trajetoria(p.trajetoria, p.r)
  return {
    origem: p.r.saida.origem,
    caminho: p.caminho,
    trajetoriaOk: traj?.ok ?? null,
    chamadasDesnecessarias: traj?.desnecessarias ?? 0,
    passos: p.r.chamadasDeModelo,
    validacoes: p.r.validacoes,
    // A primeira entrega guarda o código da violação; `violacoesDaPrimeiraEntrega` devolve o texto dele.
    violacoesDa1a: p.violacoes as CodigoDeViolacao[],
    perguntasFeitas: p.perguntasFeitas,
    perguntasRecusadas: p.contagem.recusadas,
    propostasRecusadas: p.contagem.propostasRecusadas,
    juizAprovado: p.run.juiz_aprovado,
  }
}

/** O uso do run no papel `decisao`, como o runner antigo mede. */
export function usoDoRun(run: Run, r: ResultadoDoRun): Partial<Record<Papel, UsoDoPapel>> {
  return {
    decisao: {
      chamadas: r.chamadasDeModelo,
      tokens_entrada: run.tokens_entrada,
      tokens_saida: run.tokens_saida,
    },
  }
}

/** O que o runner colhe de um caso para avaliar e para o arquivo de falhas local. */
export function colhidoDoRun(
  mensagem: string | undefined,
  saida: SaidaDoAcompanhante,
  etapas: RunEtapa[],
): Colhido {
  return {
    mensagem,
    texto: saida.resposta,
    saida,
    etapas: etapas.map((e) => ({ tipo: e.tipo, nome: e.nome, status: e.status, resumo: e.resumo })),
  }
}
