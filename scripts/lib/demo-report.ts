import { z } from "zod"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import type { Run, RunEtapa } from "@/core/runs/ports"

export type ResumoDoRun = Pick<
  Run,
  | "status"
  | "passos"
  | "tokens_entrada"
  | "tokens_saida"
  | "modelos"
  | "trocas_de_modelo"
  | "trace_id"
>

// Pensamento do modelo: a frase que sai antes da tool seguinte. depoisDaOrdem é a ordem da última etapa já feita.
export type Pensamento = { depoisDaOrdem: number; texto: string }

export type DadosDoRelatorio = {
  nome: string
  resposta: RespostaDoRun
  run: ResumoDoRun
  etapas: RunEtapa[]
  pensamentos: Pensamento[]
  disclaimer: string
}

type Item = SugestaoEntregue["itens"][number]
type Para = NonNullable<SaidaDoAcompanhante["para_ter"]>

const modelosDoRun = z.object({ decisao: z.array(z.string()).optional() })

function modelosDe(modelos: unknown): string {
  const lidos = modelosDoRun.safeParse(modelos)
  const lista = lidos.success ? (lidos.data.decisao ?? []) : []
  return lista.length > 0 ? lista.join(", ") : "nenhum"
}

function linhaDaEtapa(e: RunEtapa): string {
  const resumo = e.resumo ? ` · ${e.resumo}` : ""
  return `  ${e.ordem}. ${e.tipo} ${e.nome} [${e.status}]${resumo}`
}

// Etapas e pensamentos numa só sequência: o pensamento entra logo antes da etapa seguinte.
function linhasDasEtapas(etapas: RunEtapa[], pensamentos: Pensamento[]): string[] {
  const itens = [
    ...etapas.map((e) => ({ chave: e.ordem, linha: linhaDaEtapa(e) })),
    ...pensamentos.map((p) => ({ chave: p.depoisDaOrdem + 0.5, linha: `     "${p.texto}"` })),
  ]
  return itens.sort((a, b) => a.chave - b.chave).map((i) => i.linha)
}

function secaoEtapas(etapas: RunEtapa[], pensamentos: Pensamento[]): string[] {
  if (etapas.length === 0 && pensamentos.length === 0) return ["Etapas: nenhuma"]
  return ["Etapas", ...linhasDasEtapas(etapas, pensamentos)]
}

function secaoResposta(texto: string): string[] {
  return ["Resposta", ...texto.split("\n").map((linha) => `  ${linha}`)]
}

function linhasDoItem(item: Item): string[] {
  const marca = item.casa === "incerto" ? " [incerto]" : ""
  const troca = item.se_faltar ? [`         ${item.se_faltar.frase}`] : []
  return [`       - ${item.nome}${marca}`, ...troca]
}

function linhasDaSugestao(s: SugestaoEntregue, numero: number): string[] {
  return [
    `  ${numero}. ${s.titulo} (${s.tipo})`,
    ...(s.itens.length > 0 ? ["     Ingredientes:", ...s.itens.flatMap(linhasDoItem)] : []),
    ...(s.verbos.length > 0 ? [`     verbos: ${s.verbos.join(", ")}`] : []),
    ...(s.motivo ? [`     motivo: ${s.motivo}`] : []),
    `     modo de fazer: ${s.como_fazer}`,
    ...(s.aviso ? [`     aviso: ${s.aviso}`] : []),
  ]
}

function secaoSugestoes(sugestoes: SugestaoEntregue[]): string[] {
  if (sugestoes.length === 0) return ["Sugestões: nenhuma"]
  return ["Sugestões", ...sugestoes.flatMap((s, i) => linhasDaSugestao(s, i + 1))]
}

function secaoEvitar(evitar: SaidaDoAcompanhante["evitar"]): string[] {
  if (evitar.length === 0) return ["Evite agora: nada agora"]
  return ["Evite agora", ...evitar.map((e) => `  - ${e.texto}`)]
}

function secaoValeTerEmCasa(para: Para | undefined): string[] {
  if (!para) return ["Vale ter em casa: nada agora"]
  return [
    `Vale ter em casa: ${para.nome}`,
    `  ${para.motivo}`,
    ...(para.verbos.length > 0 ? [`  verbos: ${para.verbos.join(", ")}`] : []),
  ]
}

function secaoAvisos(avisos: SaidaDoAcompanhante["avisos"]): string[] {
  if (avisos.length === 0) return ["Avisos: nenhum"]
  return ["Avisos", ...avisos.map((a) => `  - ${a.texto}`)]
}

function secaoResumo(resposta: RespostaDoRun, run: ResumoDoRun): string[] {
  const tokens = run.tokens_entrada + run.tokens_saida
  return [
    "Resumo",
    `  status: ${run.status}`,
    `  origem: ${resposta.saida.origem}`,
    `  fim: ${resposta.fim}`,
    `  passos: ${run.passos}`,
    `  tokens: ${tokens} (entrada ${run.tokens_entrada}, saída ${run.tokens_saida})`,
    `  modelo: ${modelosDe(run.modelos)}`,
    `  trocas de modelo: ${run.trocas_de_modelo}`,
    `  trace_id: ${run.trace_id ?? "nenhum"}`,
  ]
}

// Função pura: não imprime. O script decide o que mostrar e o código de saída.
export function formatarRelatorio(d: DadosDoRelatorio): string {
  const { resposta, run } = d
  const saida = resposta.saida
  const blocos = [
    [`Cenário: ${d.nome}`],
    secaoEtapas(d.etapas, d.pensamentos),
    secaoResposta(saida.resposta),
    secaoSugestoes(saida.sugestoes),
    secaoEvitar(saida.evitar),
    secaoValeTerEmCasa(saida.para_ter),
    secaoAvisos(saida.avisos),
    [d.disclaimer],
    secaoResumo(resposta, run),
  ]
  return blocos.map((bloco) => bloco.join("\n")).join("\n\n")
}
