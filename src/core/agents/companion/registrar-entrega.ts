import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { ItemTipo } from "@/core/preferences/ports"
import type { Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { DadosDoPreparo } from "./preparo"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "./saida"

type ItemDaSugestao = SugestaoEntregue["itens"][number]

/** O alimento que de fato entrou: o da troca, quando há. */
export function idEfetivo(item: ItemDaSugestao): string {
  return item.troca?.alimento_id ?? item.alimento_id
}

export function sugestaoRegistrada(s: SugestaoEntregue): SugestaoRegistrada {
  return {
    tipo: s.tipo,
    ...(s.pratica_id ? { pratica_id: s.pratica_id } : {}),
    ...(s.preparo_id ? { preparo_id: s.preparo_id } : {}),
    alimentos: s.itens.map(idEfetivo),
    titulo: s.titulo,
  }
}

function itensSugeridos(sugestoes: SugestaoEntregue[]): { tipo: ItemTipo; id: string }[] {
  const vistos = new Set<string>()
  const itens: { tipo: ItemTipo; id: string }[] = []
  const somar = (tipo: ItemTipo, id: string | undefined) => {
    if (!id || vistos.has(`${tipo}:${id}`)) return
    vistos.add(`${tipo}:${id}`)
    itens.push({ tipo, id })
  }
  for (const s of sugestoes) {
    somar("pratica", s.pratica_id)
    somar("preparo", s.preparo_id)
    for (const item of s.itens) somar("alimento", idEfetivo(item))
  }
  return itens
}

function faltasDoRun(dados: DadosDoPreparo): string[] {
  const emCasa = new Set([...dados.casa.confirmados, ...dados.casa.incertos])
  return dados.faltas_do_run.filter((id) => !emCasa.has(id))
}

// Grava, numa transação, o que a entrega deixa: retornos aguardando, "já sugerido" e faltas.
export async function registrarEntrega(
  deps: { tx: Transactor; telemetry: Telemetry },
  p: {
    contaId: string
    runId: string
    dia: string
    saida: SaidaDoAcompanhante
    dados: DadosDoPreparo
  },
): Promise<SaidaDoAcompanhante> {
  const { saida, contaId, runId, dia, dados } = p
  if (saida.origem !== "agente" && saida.origem !== "sem_modelo") return saida
  const faltas = faltasDoRun(dados)
  const resultado = await deps.tx.emTransacao(async (s) => {
    let sugestoes = saida.sugestoes
    if (saida.sugestoes.length > 0) {
      const retornos = await s.outcomes.criar(
        contaId,
        runId,
        saida.sugestoes.map(sugestaoRegistrada),
      )
      sugestoes = saida.sugestoes.map((sug, i) => ({ ...sug, retorno_id: retornos[i]?.id }))
      await s.preferences.marcarSugerido(contaId, itensSugeridos(saida.sugestoes))
    }
    if (faltas.length > 0) {
      await s.shortages.registrar(
        contaId,
        faltas.map((alimento_id) => ({
          alimento_id,
          origem: "teria_entrado" as const,
          run_id: runId,
        })),
        dia,
      )
    }
    return { ...saida, sugestoes }
  })
  for (const _ of faltas) deps.telemetry.contador("ritu_faltas_total", { origem: "teria_entrado" })
  return resultado
}
