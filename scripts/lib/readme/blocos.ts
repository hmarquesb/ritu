// Blocos gerados do README (spec 024): números de Bastidores, link do site e lista de ADRs, em português e em inglês.
import { config, rotulosEn, textosBastidores } from "@config/index"
import { formatarMetrica } from "@/core/bastidores/evolucao"
import type { Historico } from "@/core/evals/historico"

export type Idioma = "pt" | "en"
export type Blocos = { site: string; numeros: string; adrs: string }
export type Adr = { numero: string; arquivo: string; titulo: string }

type Metrica = (typeof textosBastidores.metricas)[number]
type Checkpoint = Historico["checkpoints"][number]
type Regra = { min?: number; max?: number } | undefined

const METAS: Readonly<Record<string, Regra>> = config.evals.metas
const CURTOS: Readonly<Record<string, string>> = textosBastidores.checkpoints
const METRICAS: readonly Metrica[] = textosBastidores.metricas

const TEXTOS = {
  pt: {
    semCheckpoint: "Nenhum checkpoint rodado ainda.",
    tabela: ["Métrica", "Meta"],
    fechamento: (n: number, de: string, ate: string, base: string) =>
      `${n} ${n === 1 ? "checkpoint" : "checkpoints"}, de ${de} a ${ate}. Todos os números em [evals/COMPARACAO.md](evals/COMPARACAO.md) e em ${base}.`,
    bastidores: "Bastidores",
    site: (url: string) => `[Experimente: ${url}](${url})`,
    semSite: "No ar em breve.",
    notaAdrs: "",
  },
  en: {
    semCheckpoint: "No checkpoint run yet.",
    tabela: ["Metric", "Target"],
    fechamento: (n: number, de: string, ate: string, base: string) =>
      `${n} ${n === 1 ? "checkpoint" : "checkpoints"}, from ${de} to ${ate}. All numbers in [evals/COMPARACAO.md](evals/COMPARACAO.md) and in ${base}.`,
    bastidores: "Bastidores",
    site: (url: string) => `[Try it: ${url}](${url})`,
    semSite: "Coming soon.",
    notaAdrs: "ADRs are written in Portuguese.\n\n",
  },
} as const

function rotuloDa(id: string, idioma: Idioma): string {
  if (idioma === "en") return rotulosEn[id as keyof typeof rotulosEn] ?? id
  return METRICAS.find((m) => m.id === id)?.rotulo ?? id
}

function metaDaCelula(id: string): string {
  const regra = METAS[id]
  if (regra?.min !== undefined) return `≥ ${formatarMetrica(regra.min, formatoDe(id))}`
  if (regra?.max !== undefined) return `≤ ${formatarMetrica(regra.max, formatoDe(id))}`
  return "—"
}

function formatoDe(id: string) {
  return METRICAS.find((m) => m.id === id)?.formato ?? "num"
}

// Valor de uma métrica num checkpoint, com ⚠ quando ficou abaixo da meta naquela rodada.
function celula(c: Checkpoint | undefined, id: string): string {
  const valor = c?.metricas[id]?.valor ?? null
  const texto = formatarMetrica(valor, formatoDe(id))
  if (valor === null || !c?.abaixo_da_meta.includes(id)) return texto
  return `⚠ ${texto}`
}

// Último checkpoint que tem valor para a métrica (ou undefined).
function ultimoComValor(checkpoints: Checkpoint[], id: string): Checkpoint | undefined {
  return [...checkpoints].reverse().find((c) => c.metricas[id]?.valor != null)
}

function linhaDaMetrica(id: string, checkpoints: Checkpoint[], idioma: Idioma): string {
  const primeiro = checkpoints[0]
  const celulas = [celula(primeiro, id)]
  if (checkpoints.length > 1) celulas.push(celula(ultimoComValor(checkpoints, id), id))
  return `| ${[rotuloDa(id, idioma), ...celulas, metaDaCelula(id)].join(" | ")} |`
}

function cabecalho(checkpoints: Checkpoint[], idioma: Idioma): string {
  const [rotulo, meta] = TEXTOS[idioma].tabela
  const ultimo = checkpoints[checkpoints.length - 1]
  const primeiro = checkpoints[0]
  const colunas = checkpoints.length > 1 ? [primeiro, ultimo] : [primeiro]
  const nomes = colunas.map((c) => CURTOS[c?.checkpoint ?? ""] ?? c?.checkpoint ?? "")
  const linha = `| ${[rotulo, ...nomes, meta].join(" | ")} |`
  const separador = `|${"---|".repeat(nomes.length + 2)}`
  return `${linha}\n${separador}`
}

function tabelaDeNumeros(checkpoints: Checkpoint[], idioma: Idioma): string {
  const linhas = config.bastidores.destaques.map((id) => linhaDaMetrica(id, checkpoints, idioma))
  return [cabecalho(checkpoints, idioma), ...linhas].join("\n")
}

function numerosDoReadme(historico: Historico, idioma: Idioma, siteUrl: string | null): string {
  const t = TEXTOS[idioma]
  const checkpoints = historico.checkpoints
  if (checkpoints.length === 0) return t.semCheckpoint
  const primeiro = checkpoints[0]?.data ?? ""
  const ultimo = checkpoints[checkpoints.length - 1]?.data ?? ""
  const base = siteUrl ? `[${t.bastidores}](${siteUrl}/bastidores)` : t.bastidores
  return [
    tabelaDeNumeros(checkpoints, idioma),
    "",
    t.fechamento(checkpoints.length, primeiro, ultimo, base),
  ].join("\n")
}

function siteDoReadme(siteUrl: string | null, idioma: Idioma): string {
  const t = TEXTOS[idioma]
  return siteUrl ? t.site(siteUrl) : t.semSite
}

function adrsDoReadme(adrs: Adr[], idioma: Idioma): string {
  const lista = [...adrs]
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((a) => `- [${a.numero}](.adrs/${a.arquivo}) ${a.titulo}`)
    .join("\n")
  return `${TEXTOS[idioma].notaAdrs}${lista}`
}

export function blocosDoReadme(p: {
  historico: Historico
  adrs: Adr[]
  siteUrl: string | null
  idioma: Idioma
}): Blocos {
  return {
    site: siteDoReadme(p.siteUrl, p.idioma),
    numeros: numerosDoReadme(p.historico, p.idioma, p.siteUrl),
    adrs: adrsDoReadme(p.adrs, p.idioma),
  }
}
