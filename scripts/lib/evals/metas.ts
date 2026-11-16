// Metas das métricas (spec 014). Os valores são frações: 0,9 é 90%.
import { DEFINICAO_DAS_METRICAS, type Forma, type Medida, type MetricaId } from "./metricas"

export type Meta = { min?: number; max?: number; critica?: true }

const foraDaMeta = (valor: number, meta: Meta): boolean =>
  (meta.min !== undefined && valor < meta.min) || (meta.max !== undefined && valor > meta.max)

/** `abaixo` é "fora da meta": abaixo do mínimo ou acima do máximo. `valor: null` nunca está fora. */
export function avaliarMetas(
  metricas: Record<MetricaId, Medida>,
  metas: Record<string, Meta>,
): { abaixo: MetricaId[]; criticas: MetricaId[] } {
  const abaixo: MetricaId[] = []
  const criticas: MetricaId[] = []
  for (const id of Object.keys(DEFINICAO_DAS_METRICAS) as MetricaId[]) {
    const valor = metricas[id].valor
    const meta = metas[id]
    if (valor === null || meta === undefined || !foraDaMeta(valor, meta)) continue
    abaixo.push(id)
    if (meta.critica) criticas.push(id)
  }
  return { abaixo, criticas }
}

const numero = (valor: number, forma: Forma): string => {
  if (forma === "taxa") return `${Math.round(valor * 100)}%`
  if (forma === "ms") return `${Math.round(valor)} ms`
  return String(Number(valor.toFixed(2))).replace(".", ",")
}

export function textoDaMeta(meta: Meta | undefined, forma: Forma): string {
  if (meta === undefined) return "—"
  if (meta.max === 0 && meta.min === undefined) return "0"
  if (meta.min === 1 && meta.max === undefined && forma === "taxa") return "100%"
  const partes: string[] = []
  if (meta.min !== undefined) partes.push(`≥ ${numero(meta.min, forma)}`)
  if (meta.max !== undefined) partes.push(`≤ ${numero(meta.max, forma)}`)
  return partes.length === 0 ? "—" : partes.join(" e ")
}
