import { z } from "zod"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { Anotacao, SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Caminho, Run, RunEtapa } from "@/core/runs/ports"

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

// Resposta do Acompanhante (run da 007) ou da conversa: o relatório só precisa destes campos.
export type RespostaDoRelatorio = Pick<RespostaDoRun, "run_id" | "saida"> & {
  fim?: RespostaDoRun["fim"]
}

// Pensamento do modelo: a frase que sai antes da tool seguinte. depoisDaOrdem é a ordem da última etapa já feita.
export type Pensamento = { depoisDaOrdem: number; texto: string }

export type DadosDoRelatorio = {
  nome: string
  resposta: RespostaDoRelatorio
  run: ResumoDoRun
  etapas: RunEtapa[]
  pensamentos: Pensamento[]
  disclaimer: string
  // Só a conversa tem caminho e interpretação; sem eles, os blocos Entendi e Posso anotar não aparecem.
  caminho?: Caminho
  interpretacao?: Interpretacao
  // Nome de quem o Evitar cita; padrão: o próprio valor.
  nomeDoEvitar?: (item: EvitarItem) => string
}

type Item = SugestaoEntregue["itens"][number]
type Para = NonNullable<SaidaDoAcompanhante["para_ter"]>

const ROTULO_DA_ANOTACAO: Record<Anotacao["tipo"], string> = {
  casa_tem: "tem em casa",
  casa_acabou: "acabou em casa",
  evitar_sempre: "evitar sempre",
  nao_come: "não come",
  gosta: "gosta",
  restricao: "restrição",
}

const ROTULO_DA_ACAO: Record<"tem" | "acabou", string> = { tem: "tem", acabou: "acabou" }

const modelosDoRun = z.object({
  decisao: z.array(z.string()).optional(),
  apoio: z.array(z.string()).optional(),
})

function listaDeModelos(lista: string[]): string {
  return lista.length > 0 ? lista.join(", ") : "nenhum"
}

function modelosDe(modelos: unknown): { decisao: string[]; apoio: string[] } {
  const lidos = modelosDoRun.safeParse(modelos)
  if (!lidos.success) return { decisao: [], apoio: [] }
  return { decisao: lidos.data.decisao ?? [], apoio: lidos.data.apoio ?? [] }
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

function nomeDoItemAnotado(item: { nome: string } | string): string {
  return typeof item === "string" ? item : item.nome
}

function nomesDaAnotacao(a: Anotacao, nomeDoEvitar: (item: EvitarItem) => string): string[] {
  if (a.tipo === "evitar_sempre") return a.itens.map(nomeDoEvitar)
  if (a.tipo === "restricao") return a.itens
  return a.itens.map(nomeDoItemAnotado)
}

function linhaDaAnotacao(a: Anotacao, nomeDoEvitar: (item: EvitarItem) => string): string {
  return `  - ${ROTULO_DA_ANOTACAO[a.tipo]}: ${nomesDaAnotacao(a, nomeDoEvitar).join(", ")}`
}

function secaoAnotacoes(
  anotacoes: Anotacao[],
  nomeDoEvitar: (item: EvitarItem) => string,
): string[] {
  if (anotacoes.length === 0) return []
  return ["Posso anotar", ...anotacoes.map((a) => linhaDaAnotacao(a, nomeDoEvitar))]
}

function linhasDoRetorno(r: NonNullable<Interpretacao["retorno"]>): string {
  const titulo = r.titulo ? ` · ${r.titulo}` : ""
  const ligacao = r.retorno_id ? "" : " (sem ligação)"
  return `  retorno: ${r.resultado}${titulo}${ligacao}`
}

function linhasDaCasa(itens: Interpretacao["itens_casa"]): string {
  const lista = itens.map((i) => `${i.nome} (${ROTULO_DA_ACAO[i.acao]})`)
  return `  em casa: ${lista.join(", ")}`
}

// Só as linhas dos campos que a mensagem citou; campo vazio não aparece.
function linhasDaInterpretacao(
  i: Interpretacao,
  nomeDoEvitar: (item: EvitarItem) => string,
): string[] {
  return [
    ...(i.intencoes.length > 0 ? [`  intenções: ${i.intencoes.join(", ")}`] : []),
    ...(i.estados.length > 0 ? [`  estados: ${i.estados.join(", ")}`] : []),
    ...(i.incomodo ? [`  incômodo: ${i.incomodo.id}`] : []),
    ...(i.itens_casa.length > 0 ? [linhasDaCasa(i.itens_casa)] : []),
    ...(i.retorno ? [linhasDoRetorno(i.retorno)] : []),
    ...(i.evitar.length > 0 ? [`  evitar: ${i.evitar.map(nomeDoEvitar).join(", ")}`] : []),
  ]
}

function secaoEntendi(
  caminho: Caminho | undefined,
  interpretacao: Interpretacao | undefined,
  nomeDoEvitar: (item: EvitarItem) => string,
): string[] {
  const linhas = [
    ...(caminho ? [`  caminho: ${caminho}`] : []),
    ...(interpretacao ? linhasDaInterpretacao(interpretacao, nomeDoEvitar) : []),
  ]
  return linhas.length > 0 ? ["Entendi", ...linhas] : []
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

function linhasDoItem(item: Item): string[] {
  const marca = item.casa === "incerto" ? " [incerto]" : ""
  const troca = item.se_faltar ? [`         ${item.se_faltar.frase}`] : []
  return [`       - ${item.nome}${marca}`, ...troca]
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

function secaoResumo(resposta: RespostaDoRelatorio, run: ResumoDoRun): string[] {
  const tokens = run.tokens_entrada + run.tokens_saida
  const modelos = modelosDe(run.modelos)
  return [
    "Resumo",
    `  status: ${run.status}`,
    `  origem: ${resposta.saida?.origem ?? "pausa"}`,
    ...(resposta.fim ? [`  fim: ${resposta.fim}`] : []),
    `  passos: ${run.passos}`,
    `  tokens: ${tokens} (entrada ${run.tokens_entrada}, saída ${run.tokens_saida})`,
    `  modelo: ${listaDeModelos(modelos.decisao)}`,
    ...(modelos.apoio.length > 0 ? [`  apoio: ${listaDeModelos(modelos.apoio)}`] : []),
    `  trocas de modelo: ${run.trocas_de_modelo}`,
    `  trace_id: ${run.trace_id ?? "nenhum"}`,
  ]
}

const nomeSemMudar = (item: EvitarItem): string => item.valor

// Função pura: não imprime. O script decide o que mostrar e o código de saída.
export function formatarRelatorio(d: DadosDoRelatorio): string {
  const { resposta, run } = d
  const saida = resposta.saida
  const nomeDoEvitar = d.nomeDoEvitar ?? nomeSemMudar
  const blocos = [
    [`Cenário: ${d.nome}`],
    secaoEntendi(d.caminho, d.interpretacao, nomeDoEvitar),
    secaoEtapas(d.etapas, d.pensamentos),
    secaoResposta(saida?.resposta ?? ""),
    secaoAnotacoes(saida?.anotacoes ?? [], nomeDoEvitar),
    secaoSugestoes(saida?.sugestoes ?? []),
    secaoEvitar(saida?.evitar ?? []),
    secaoValeTerEmCasa(saida?.para_ter),
    secaoAvisos(saida?.avisos ?? []),
    [d.disclaimer],
    secaoResumo(resposta, run),
  ]
  return blocos
    .filter((bloco) => bloco.length > 0)
    .map((bloco) => bloco.join("\n"))
    .join("\n\n")
}
