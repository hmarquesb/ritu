import { juiz as configDoJuiz } from "@config/juiz"
import { nuncaCitar } from "@/core/agents/judge/entrada"
import type { Judge, Veredito } from "@/core/agents/judge/julgar"
import { mensagemDaNovaTentativa } from "@/core/agents/judge/textos"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { ModelRouter } from "@/core/llm/router"
import type { DefinicaoDoAgente } from "@/core/runs/agente"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { NovaEtapa, RunEtapa } from "@/core/runs/ports"
import type { createRunService, ResultadoDoRun } from "@/core/runs/run-service"
import type { Telemetry } from "@/core/telemetry/ports"
import type { ToolContext } from "@/core/tools/tool"
import type { DadosDoPreparo } from "./preparo"
import { type SaidaDoAcompanhante, saidaDoAcompanhanteSchema, saidaSegura } from "./saida"

export type CamposDoJuiz = {
  juiz_tentativas: number
  juiz_aprovado: boolean | null
  tokens: { entrada: number; saida: number } // só os do Juiz
  apoio: string[]
  reforco: string[]
  trocas_reforco: number
}

export type EntregaJulgada = { resultado: ResultadoDoRun; campos: CamposDoJuiz }

type Deps = {
  judge: Judge
  runs: ReturnType<typeof createRunService>
  router: ModelRouter
  kb: KnowledgeBase
  telemetry: Telemetry
  clock: Clock
}

type Pedido = {
  dados: DadosDoPreparo
  agente: DefinicaoDoAgente
  ctx: ToolContext
  aoVivo?: (e: EventoAoVivo) => void
}

type Proposta = NonNullable<SaidaDoAcompanhante["propostas_do_agente"]>[number]
type Rotina = Extract<Proposta, { tool: "memoria.propor"; tipo: "rotina" }>

function camposVazios(): CamposDoJuiz {
  return {
    juiz_tentativas: 0,
    juiz_aprovado: null,
    tokens: { entrada: 0, saida: 0 },
    apoio: [],
    reforco: [],
    trocas_reforco: 0,
  }
}

// A saída do agente que o Juiz lê; qualquer outra origem ou fim não é julgada.
function saidaDoAgente(resultado: ResultadoDoRun): SaidaDoAcompanhante | undefined {
  if (resultado.fim.tipo !== "entregue") return undefined
  const lida = saidaDoAcompanhanteSchema.safeParse(resultado.fim.saida)
  return lida.success && lida.data.origem === "agente" ? lida.data : undefined
}

function ehRotina(proposta: Proposta): proposta is Rotina {
  return proposta.tool === "memoria.propor" && proposta.tipo === "rotina"
}

function notaDeRotina(saida: SaidaDoAcompanhante): string | undefined {
  return saida.propostas_do_agente?.find(ehRotina)?.texto
}

// Tira da saída as propostas de rotina marcadas pelo Juiz; as outras ficam.
function semRotina(saida: SaidaDoAcompanhante, tirar: (texto: string) => boolean) {
  const lista = saida.propostas_do_agente
  if (!lista) return saida
  const resto = lista.filter((p) => !(ehRotina(p) && tirar(p.texto)))
  const { propostas_do_agente: _antes, ...base } = saida
  return resto.length > 0 ? { ...base, propostas_do_agente: resto } : base
}

function resumoDe(v: Veredito): string {
  if (!v.ok) return "indisponivel"
  const registros = v.registros.length > 0 ? `registros: ${v.registros.join(", ")}` : undefined
  if (v.aprovado) return registros ? `aprovado; ${registros}` : "aprovado"
  const graves = `reprovado: ${v.graves.join(", ")}`
  return registros ? `${graves}; ${registros}` : graves
}

function etapaDoJuiz(v: Veredito): NovaEtapa {
  const base = {
    tipo: "juiz",
    nome: "juiz",
    resumo: resumoDe(v),
    duracao_ms: v.duracao_ms,
  } as const
  if (!v.ok) return { ...base, status: "falhou", modelo: null, tokens_entrada: 0, tokens_saida: 0 }
  return {
    ...base,
    status: v.aprovado ? "ok" : "recusado",
    modelo: v.modelo,
    tokens_entrada: v.tokens.entrada,
    tokens_saida: v.tokens.saida,
  }
}

// Soma ao run o que a leitura do Juiz gastou.
function somarLeitura(campos: CamposDoJuiz, v: Extract<Veredito, { ok: true }>): void {
  campos.tokens.entrada += v.tokens.entrada
  campos.tokens.saida += v.tokens.saida
  if (!campos.apoio.includes(v.modelo)) campos.apoio.push(v.modelo)
}

// Guarda o texto da rotina que o Juiz apontou por saúde, para tirá-lo também da tentativa seguinte.
function marcarRotina(
  marcadas: Set<string>,
  saida: SaidaDoAcompanhante,
  v: Extract<Veredito, { ok: true }>,
): void {
  const nota = notaDeRotina(saida)
  if (v.saude_na_proposta && nota !== undefined) marcadas.add(nota)
}

function aprovada(
  saida: SaidaDoAcompanhante,
  v: Extract<Veredito, { ok: true }>,
  marcadas: Set<string>,
): SaidaDoAcompanhante {
  return semRotina(saida, (texto) => v.saude_na_proposta || marcadas.has(texto))
}

function entregaSegura(
  resultado: ResultadoDoRun,
  dados: DadosDoPreparo,
  campos: CamposDoJuiz,
  aprovado: boolean | null,
): EntregaJulgada {
  campos.juiz_aprovado = aprovado
  return { resultado: entregue(resultado, saidaSegura(dados)), campos }
}

function entregue(resultado: ResultadoDoRun, saida: SaidaDoAcompanhante): ResultadoDoRun {
  return { ...resultado, fim: { tipo: "entregue", saida } }
}

export function criarJuizDoRun(deps: Deps) {
  const { judge, runs, router, kb, clock } = deps

  // Uma leitura do Juiz: chama, grava a etapa `juiz` e avisa quem acompanha.
  async function ler(
    contaId: string,
    runId: string,
    p: Pedido,
    pedido: { saida: SaidaDoAcompanhante; tentativa: number; preferir?: string },
  ): Promise<Veredito> {
    p.aoVivo?.({ tipo: "etapa_iniciada", etapa: { tipo: "juiz", nome: "juiz" } })
    const nota = notaDeRotina(pedido.saida)
    const inicio = clock.now().getTime()
    let v: Veredito
    try {
      v = await judge.julgar({
        saida: pedido.saida,
        evitar: nuncaCitar(p.dados, kb),
        ...(nota !== undefined ? { nota_de_rotina: nota } : {}),
        tentativa: pedido.tentativa,
        ...(pedido.preferir !== undefined ? { preferir: pedido.preferir } : {}),
      })
    } catch {
      v = { ok: false, motivo: "erro", duracao_ms: clock.now().getTime() - inicio }
    }
    const etapa: RunEtapa = await runs.gravarEtapa(contaId, runId, etapaDoJuiz(v))
    p.aoVivo?.({ tipo: "etapa_concluida", etapa })
    return v
  }

  async function falharNovaTentativa(contaId: string, runId: string, nome: string): Promise<void> {
    await runs.gravarEtapa(contaId, runId, {
      tipo: "erro",
      nome: `nova_tentativa:${nome}`,
      status: "falhou",
      duracao_ms: 0,
      resumo: null,
      modelo: null,
      tokens_entrada: 0,
      tokens_saida: 0,
    })
  }

  // Nova tentativa no papel `reforco`, sem `ask_user` (D5); sem saída do agente, a etapa de erro explica.
  async function novaTentativa(
    contaId: string,
    atual: ResultadoDoRun,
    v: Extract<Veredito, { ok: true }>,
    p: Pedido,
    campos: CamposDoJuiz,
  ): Promise<{ resultado: ResultadoDoRun; saida?: SaidaDoAcompanhante }> {
    const estado = atual.estado
    if (!estado) {
      await falharNovaTentativa(contaId, atual.run.id, "sem_estado")
      return { resultado: atual }
    }
    const agente = {
      ...p.agente,
      controle: p.agente.controle.filter((c) => c.name !== "ask_user"),
    }
    const resultado = await runs.executarRun(contaId, atual.run.id, {
      agente,
      ctx: p.ctx,
      estado: {
        ...estado,
        mensagens: [
          ...estado.mensagens,
          { papel: "sistema", conteudo: mensagemDaNovaTentativa(v.apontamentos) },
        ],
        chamadas_extras: configDoJuiz.chamadasDaNovaTentativa,
        entregas_recusadas: 0,
      },
      modelo: router.paraPapel("reforco", {
        aoTrocar: () => {
          campos.trocas_reforco += 1
        },
      }),
      aoVivo: p.aoVivo,
      aoGravarEtapa(e: RunEtapa) {
        if (e.tipo === "llm" && e.modelo && !campos.reforco.includes(e.modelo)) {
          campos.reforco.push(e.modelo)
        }
      },
    })
    const saida = saidaDoAgente(resultado)
    if (!saida) await falharNovaTentativa(contaId, resultado.run.id, resultado.fim.tipo)
    return { resultado, saida }
  }

  async function julgarSaida(
    contaId: string,
    resultado: ResultadoDoRun,
    primeira: SaidaDoAcompanhante,
    p: Pedido,
  ): Promise<EntregaJulgada> {
    const campos = camposVazios()
    const marcadas = new Set<string>()
    const segura = (r: ResultadoDoRun, aprovado: boolean | null) =>
      entregaSegura(r, p.dados, campos, aprovado)
    let atual = resultado
    let saida = primeira
    let preferir: string | undefined
    for (let t = 1; t <= configDoJuiz.maxTentativas; t++) {
      campos.juiz_tentativas = t
      const v = await ler(contaId, atual.run.id, p, { saida, tentativa: t, preferir })
      if (!v.ok) return segura(atual, null)
      preferir = v.modelo
      somarLeitura(campos, v)
      marcarRotina(marcadas, saida, v)
      if (v.aprovado) {
        campos.juiz_aprovado = true
        return { resultado: entregue(atual, aprovada(saida, v, marcadas)), campos }
      }
      if (t >= configDoJuiz.maxTentativas) return segura(atual, false)
      const nova = await novaTentativa(contaId, atual, v, p, campos)
      atual = nova.resultado
      if (!nova.saida) return segura(atual, false)
      saida = nova.saida
    }
    return segura(atual, false)
  }

  async function julgarEntrega(
    contaId: string,
    resultado: ResultadoDoRun,
    p: Pedido,
  ): Promise<EntregaJulgada> {
    const primeira = saidaDoAgente(resultado)
    if (!primeira) return { resultado, campos: camposVazios() }
    return julgarSaida(contaId, resultado, primeira, p)
  }

  return { julgarEntrega }
}
