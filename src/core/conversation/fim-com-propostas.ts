import { dadosDoPreparoSchema } from "@/core/agents/companion/preparo"
import type { Anotacao, SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import { montarFiltro } from "@/core/filtro-da-pessoa"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import { padraoParaOBloco } from "@/core/patterns/bloco"
import { type ConteudoDaProposta, semTool } from "@/core/proposals/conteudo"
import { montarPropostas, propostaDoParaTer } from "@/core/proposals/montar"
import { textoDaProposta } from "@/core/proposals/textos"
import type { EventoAoVivo } from "@/core/runs/loop"
import type { Caminho, NovaEtapa, Run } from "@/core/runs/ports"
import { diaLocal } from "@/core/time/dia-local"
import type { Deps } from "./conversar"

type DepsDoFim = Pick<Deps, "stores" | "kb" | "runs" | "telemetry" | "clock">
type Pedido = {
  contaId: string
  runId: string
  caminho: Caminho
  comIncomodo: boolean
  saida: SaidaDoAcompanhante
  anotacoes: Anotacao[]
  filtro?: FiltroPessoa
  aoVivo?: (e: EventoAoVivo) => void
}

const SEM_PROPOSTA: readonly Caminho[] = ["alerta", "fora", "ofensa", "ajuda"]

function resumoDaProposta(c: ConteudoDaProposta): string {
  if (c.tool === "lista.propor") return "lista"
  if (c.tool === "padrao.confirmar") return "padrao"
  if (c.tool === "memoria.propor" && c.tipo === "rotina") return "rotina"
  const chave = c.tool === "casa.propor" ? "casa" : c.tipo
  const n = c.itens.length
  return `${chave}: ${n} ${n === 1 ? "item" : "itens"}`
}

function etapaDaProposta(c: ConteudoDaProposta): NovaEtapa {
  return {
    tipo: "proposta",
    nome: c.tool,
    status: "ok",
    resumo: resumoDaProposta(c),
    duracao_ms: 0,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  }
}

function semInternos(saida: SaidaDoAcompanhante): SaidaDoAcompanhante {
  const { propostas_do_agente: _interno, ...resto } = saida
  return resto
}

/** O filtro da pessoa guardado no checkpoint do run; sem filtro válido, undefined. */
export function filtroDoRun(run: Run): FiltroPessoa | undefined {
  const dados = (run.checkpoint as { dados?: { filtro?: unknown } } | null)?.dados
  const lido = dadosDoPreparoSchema.shape.filtro.safeParse(dados?.filtro)
  return lido.success ? lido.data : undefined
}

// Um padrão candidato entra no fim dos runs do acompanhante respondidos pelo agente, sem incômodo (D9).
async function padraoDoFim(deps: DepsDoFim, p: Pedido): Promise<ConteudoDaProposta[]> {
  if (p.caminho !== "acompanhante" || p.saida.origem !== "agente") return []
  const { stores, clock } = deps
  const perfil = await stores.profiles.ler(p.contaId)
  const fuso = perfil.cidade_fuso ?? undefined
  // Run que não pausou não tem checkpoint: o filtro do dia sai do perfil, da lista temporária e dos gostos (D17).
  const filtro =
    p.filtro ??
    montarFiltro({
      perfil,
      evitarDoDia: await stores.profiles.evitarTemporario(p.contaId, diaLocal(clock.now(), fuso)),
      evitarDaMensagem: [],
      preferencias: await stores.preferences.ler(p.contaId),
    }).filtro
  return padraoParaOBloco(deps, p.contaId, { filtro, fuso })
}

async function propostasDoFim(deps: DepsDoFim, p: Pedido): Promise<ConteudoDaProposta[]> {
  if (p.comIncomodo || SEM_PROPOSTA.includes(p.caminho)) return []
  return montarPropostas({
    anotacoes: p.anotacoes,
    doAgente: p.saida.propostas_do_agente ?? [],
    extras: [...propostaDoParaTer(p.saida), ...(await padraoDoFim(deps, p))],
  })
}

/** Fecha um run em running: sem propostas vai a done; com propostas, cria as linhas e pausa para aprovação. */
export async function fecharComPropostas(deps: DepsDoFim, p: Pedido): Promise<SaidaDoAcompanhante> {
  const { stores, kb, runs } = deps
  const propostas = await propostasDoFim(deps, p)
  const base = { ...semInternos(p.saida), anotacoes: p.anotacoes }
  if (propostas.length === 0) {
    const final = { ...base, propostas: [] }
    await runs.encerrar(p.contaId, p.runId, "done", { saida: final })
    return final
  }
  const criadas = await stores.proposals.criar(p.contaId, p.runId, propostas.map(semTool))
  for (const proposta of propostas) {
    const etapa = etapaDaProposta(proposta)
    p.aoVivo?.({ tipo: "etapa_iniciada", etapa: { tipo: etapa.tipo, nome: etapa.nome } })
    const gravada = await runs.gravarEtapa(p.contaId, p.runId, etapa)
    p.aoVivo?.({ tipo: "etapa_concluida", etapa: gravada })
  }
  const final = {
    ...base,
    propostas: propostas.flatMap((proposta, i) => {
      const criada = criadas[i]
      if (!criada) return []
      return [{ id: criada.id, tool: proposta.tool, texto: textoDaProposta(proposta, kb) }]
    }),
  }
  await runs.pausarSemAgente(
    p.contaId,
    p.runId,
    { tipo: "aprovacao", conteudo: { propostas: criadas.map((c) => c.id) } },
    { saida: final },
  )
  return final
}

/** Como `fecharComPropostas`, mas se ele lançar o run vai a failed (se ainda em running) e a saída segue sem propostas (D8). */
export async function fecharOuFalhar(deps: DepsDoFim, p: Pedido): Promise<SaidaDoAcompanhante> {
  try {
    return await fecharComPropostas(deps, p)
  } catch {
    const final = { ...semInternos(p.saida), anotacoes: p.anotacoes, propostas: [] }
    const atual = await deps.stores.runs.buscar(p.contaId, p.runId)
    if (atual?.status === "running") {
      await deps.runs.encerrar(p.contaId, p.runId, "failed", { saida: final })
    }
    return final
  }
}
