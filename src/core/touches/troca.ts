import type { SugestaoEntregue } from "@/core/agents/companion/saida"
import { RituError } from "@/core/errors"
import type { Stores } from "@/core/stores"
import type { NomeDeMetrica } from "@/core/telemetry/nomes"
import type { Atributos } from "@/core/telemetry/ports"
import {
  type Alvo,
  acharAlvo,
  aplicarTroca,
  type ContextoDaTroca,
  contextoDaTroca,
  noTeto,
  perfilEDia,
  perguntaDaTroca,
} from "./aplicar-troca"
import type { Deps } from "./deps"
import { textoSemSubstituto } from "./textos"

export type MotivoDaTroca = "trocar" | "nao_tenho" | "nao_gosto"
export type ResultadoDaTroca =
  | { resultado: "trocou"; sugestao: SugestaoEntregue }
  | { resultado: "perguntar"; pergunta: { alimento_id: string; nome: string; texto: string } }
  | { resultado: "sem_substituto"; texto: string }

type Metrica = { nome: NomeDeMetrica; rotulos: Atributos }
type Corpo = { resultado: ResultadoDaTroca; metricas: Metrica[] } | undefined
type Pedido = { runId: string; sugestao: number; alimento_id: string }

const trocaMetrica = (resultado: string): Metrica => ({
  nome: "ritu_troca_ingrediente_total",
  rotulos: { resultado },
})

function semSubstituto(alvo: Alvo, metricas: Metrica[]): Corpo {
  metricas.push(trocaMetrica("sem_substituto"))
  const texto = textoSemSubstituto(alvo.item.nome)
  return { resultado: { resultado: "sem_substituto", texto }, metricas }
}

// Passo 2: o que o motivo grava fica gravado nos três resultados.
async function gravarMotivo(
  s: Stores,
  contaId: string,
  p: Pedido & { motivo: MotivoDaTroca },
  dia: string,
  metricas: Metrica[],
): Promise<void> {
  if (p.motivo === "nao_tenho") {
    await s.pantry.marcarAcabou(contaId, [{ alimento_id: p.alimento_id }])
    await s.shortages.registrar(
      contaId,
      [{ alimento_id: p.alimento_id, origem: "nao_tenho", run_id: p.runId }],
      dia,
    )
    metricas.push({ nome: "ritu_faltas_total", rotulos: { origem: "nao_tenho" } })
  } else if (p.motivo === "nao_gosto") {
    await s.preferences.definirGosto(contaId, { tipo: "alimento", id: p.alimento_id }, "nao_gosta")
    metricas.push({ nome: "ritu_gosto_total", rotulos: { gosto: "nao_gosta" } })
  }
}

async function trocarNoCorpo(
  deps: Deps,
  s: Stores,
  contaId: string,
  p: Pedido & { motivo: MotivoDaTroca },
): Promise<Corpo> {
  await s.runs.atualizar(contaId, p.runId, {}) // trava a linha do run até o commit (D10)
  const alvo = await acharAlvo(s, contaId, p)
  if (!alvo) return undefined
  const metricas: Metrica[] = []
  const quando = await perfilEDia(deps, s, contaId)
  await gravarMotivo(s, contaId, p, quando.dia, metricas)
  const ctx = await contextoDaTroca(deps, s, contaId, alvo, quando)
  if (noTeto(alvo.item)) return semSubstituto(alvo, metricas)
  const confirmado = ctx.candidatos.find((c) => ctx.confirmados.has(c.alimento_id))
  if (confirmado) return trocou(deps, s, contaId, alvo, confirmado, metricas)
  const pergunta = perguntaDaTroca(deps, ctx)
  if (pergunta) return { resultado: { resultado: "perguntar", pergunta }, metricas }
  return semSubstituto(alvo, metricas)
}

async function trocou(
  deps: Deps,
  s: Stores,
  contaId: string,
  alvo: Alvo,
  substituto: ContextoDaTroca["candidatos"][number],
  metricas: Metrica[],
): Promise<Corpo> {
  const sugestao = await aplicarTroca(deps, s, contaId, alvo, substituto)
  metricas.push(trocaMetrica("trocou"))
  return { resultado: { resultado: "trocou", sugestao }, metricas }
}

async function responderNoCorpo(
  deps: Deps,
  s: Stores,
  contaId: string,
  p: Pedido & { candidato: string; resposta: "tenho" | "nao_tenho" },
): Promise<Corpo> {
  await s.runs.atualizar(contaId, p.runId, {})
  const alvo = await acharAlvo(s, contaId, p)
  if (!alvo) return undefined
  const metricas: Metrica[] = []
  const quando = await perfilEDia(deps, s, contaId)
  const ctx = await contextoDaTroca(deps, s, contaId, alvo, quando)
  const candidato = ctx.candidatos.find((c) => c.alimento_id === p.candidato)
  if (noTeto(alvo.item) || !candidato) return semSubstituto(alvo, metricas)
  if (p.resposta === "tenho") {
    await s.pantry.registrar(contaId, [{ alimento_id: p.candidato }], "pergunta")
    return trocou(deps, s, contaId, alvo, candidato, metricas)
  }
  await s.pantry.marcarAcabou(contaId, [{ alimento_id: p.candidato }])
  await s.shortages.registrar(
    contaId,
    [{ alimento_id: p.candidato, origem: "nao_tenho", run_id: p.runId }],
    quando.dia,
  )
  metricas.push({ nome: "ritu_faltas_total", rotulos: { origem: "nao_tenho" } })
  return semSubstituto(alvo, metricas)
}

// Fora da transação: o erro não desfaz nada que já foi confirmado, e o inválido não grava nada.
async function executar(
  deps: Deps,
  motivo: MotivoDaTroca,
  corpo: (s: Stores) => Promise<Corpo>,
): Promise<ResultadoDaTroca> {
  return deps.telemetry.span("toque", { tipo: "troca", motivo }, async (span) => {
    const feito = await deps.tx.emTransacao(corpo)
    if (!feito) throw new RituError("toque_invalido", "Toque inválido")
    for (const m of feito.metricas) deps.telemetry.contador(m.nome, m.rotulos)
    span.atribuir({ resultado: feito.resultado.resultado })
    return feito.resultado
  })
}

export function trocarIngrediente(
  deps: Deps,
  contaId: string,
  p: Pedido & { motivo: MotivoDaTroca },
): Promise<ResultadoDaTroca> {
  return executar(deps, p.motivo, (s) => trocarNoCorpo(deps, s, contaId, p))
}

export function responderTroca(
  deps: Deps,
  contaId: string,
  p: Pedido & { candidato: string; resposta: "tenho" | "nao_tenho" },
): Promise<ResultadoDaTroca> {
  return executar(deps, "trocar", (s) => responderNoCorpo(deps, s, contaId, p))
}
