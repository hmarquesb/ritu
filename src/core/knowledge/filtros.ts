import { normalizar } from "./identificar"
import type { KnowledgeBase } from "./knowledge-base"
import type { Alimento, Pratica, Preparo, Vaga } from "./schemas"
import type { Restricao } from "./vocab"

export type EvitarItem = { tipo: "grupo" | "alimento" | "texto"; valor: string }
export type FiltroPessoa = {
  evitar: EvitarItem[]
  restricoes: Restricao[]
  nao_come: string[]
  nao_gosta: string[]
}
export type MotivoFiltro = "evitar_sempre" | "restricao" | "nao_come" | "nao_gosta"
export type ResultadoFiltro = { passa: boolean; motivo?: MotivoFiltro }

export const filtroVazio: Readonly<FiltroPessoa> = Object.freeze({
  evitar: Object.freeze([] as EvitarItem[]) as EvitarItem[],
  restricoes: Object.freeze([] as Restricao[]) as Restricao[],
  nao_come: Object.freeze([] as string[]) as string[],
  nao_gosta: Object.freeze([] as string[]) as string[],
})

// Ordem de desempate: o primeiro da lista vence quando dois motivos empatam.
const ORDEM_MOTIVOS: MotivoFiltro[] = ["evitar_sempre", "restricao", "nao_come", "nao_gosta"]

function evitadoSempre(alimento: Alimento, evitar: EvitarItem[]): boolean {
  const nomes = [alimento.nome, ...alimento.sinonimos].map(normalizar)
  return evitar.some((item) => {
    if (item.tipo === "grupo") return alimento.grupos_evitar.some((g) => g === item.valor)
    if (item.tipo === "alimento") return item.valor === alimento.id
    return nomes.includes(normalizar(item.valor))
  })
}

function motivoDoAlimento(alimento: Alimento, filtro: FiltroPessoa): MotivoFiltro | undefined {
  if (evitadoSempre(alimento, filtro.evitar)) return "evitar_sempre"
  if (filtro.restricoes.some((r) => alimento.restricoes.includes(r))) return "restricao"
  if (filtro.nao_come.includes(alimento.id)) return "nao_come"
  if (filtro.nao_gosta.includes(alimento.id)) return "nao_gosta"
  return undefined
}

function reprova(motivo?: MotivoFiltro): ResultadoFiltro {
  return motivo ? { passa: false, motivo } : { passa: false }
}

function resultadoPratica(
  pratica: Pratica,
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): ResultadoFiltro {
  for (const id of pratica.ingredientes) {
    const alimento = kb.alimento(id)
    const motivo = alimento && motivoDoAlimento(alimento, filtro)
    if (motivo) return reprova(motivo)
  }
  if (filtro.restricoes.some((r) => pratica.nunca_sugerir_se.includes(r))) {
    return reprova("restricao")
  }
  return { passa: true }
}

// Único lugar que decide se um alimento serve a uma vaga.
export function serveAVaga(
  alimento: Alimento,
  vaga: Pick<Vaga, "funcao" | "grupos" | "alimentos">,
): boolean {
  if (vaga.alimentos) {
    return vaga.alimentos.includes(alimento.id) && alimento.funcoes.includes(vaga.funcao)
  }
  return (
    alimento.funcoes.includes(vaga.funcao) && (!vaga.grupos || vaga.grupos.includes(alimento.grupo))
  )
}

// Alimentos que servem a uma vaga.
export function candidatosDaVaga(
  vaga: Pick<Vaga, "funcao" | "grupos" | "alimentos">,
  kb: KnowledgeBase,
): Alimento[] {
  return kb.alimentos.filter((a) => serveAVaga(a, vaga))
}

function motivoMaisFrequente(motivos: MotivoFiltro[]): MotivoFiltro | undefined {
  let melhor: MotivoFiltro | undefined
  let melhorContagem = 0
  for (const motivo of ORDEM_MOTIVOS) {
    const contagem = motivos.filter((m) => m === motivo).length
    if (contagem > melhorContagem) {
      melhor = motivo
      melhorContagem = contagem
    }
  }
  return melhor
}

// Vaga vazia: nenhum candidato passa. O motivo é o mais frequente entre os reprovados.
function vagaVazia(
  vaga: Vaga,
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): { vazia: false } | { vazia: true; motivo?: MotivoFiltro } {
  const motivos: MotivoFiltro[] = []
  for (const alimento of candidatosDaVaga(vaga, kb)) {
    const motivo = motivoDoAlimento(alimento, filtro)
    if (!motivo) return { vazia: false }
    motivos.push(motivo)
  }
  return { vazia: true, motivo: motivoMaisFrequente(motivos) }
}

function resultadoPreparo(
  preparo: Preparo,
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): ResultadoFiltro {
  for (const vaga of preparo.vagas) {
    if (!vaga.obrigatoria) continue
    const veredito = vagaVazia(vaga, filtro, kb)
    if (veredito.vazia) return reprova(veredito.motivo)
  }
  return { passa: true }
}

function resultadoAlimento(alimento: Alimento, filtro: FiltroPessoa): ResultadoFiltro {
  const motivo = motivoDoAlimento(alimento, filtro)
  return motivo ? reprova(motivo) : { passa: true }
}

export function passaNoFiltro(
  alvo: Alimento | Preparo | Pratica,
  filtro: FiltroPessoa,
  kb: KnowledgeBase,
): ResultadoFiltro {
  if ("vagas" in alvo) return resultadoPreparo(alvo, filtro, kb)
  if ("tipo" in alvo) return resultadoPratica(alvo, filtro, kb)
  return resultadoAlimento(alvo, filtro)
}
