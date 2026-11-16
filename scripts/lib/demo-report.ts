import { z } from "zod"
import type { RespostaDoRun } from "@/core/agents/companion/responder"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Resultado } from "@/core/outcomes/ports"
import type { StatusPadrao } from "@/core/patterns/ports"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import { textoDaResposta } from "@/core/runs/pergunta"
import type { Caminho, Run, RunEtapa } from "@/core/runs/ports"
import type { ItemDaLista } from "@/core/shortages/ports"
import type { MotivoDaTroca } from "@/core/touches"
import { formatarBloco, formatarPergunta } from "./demo-resposta"

export type ResumoDoRun = Pick<
  Run,
  | "status"
  | "passos"
  | "tokens_entrada"
  | "tokens_saida"
  | "modelos"
  | "trocas_de_modelo"
  | "trace_id"
  | "juiz_tentativas"
  | "juiz_aprovado"
>

// Resposta do Acompanhante (run da 007) ou da conversa: o relatório só precisa destes campos.
export type RespostaDoRelatorio = Pick<RespostaDoRun, "run_id" | "saida"> & {
  fim?: RespostaDoRun["fim"]
}

// Pensamento do modelo: a frase que sai antes da tool seguinte. depoisDaOrdem é a ordem da última etapa já feita.
export type Pensamento = { depoisDaOrdem: number; texto: string }

// Decisão do bloco de aprovação: quantas linhas ficaram marcadas e o que foi gravado.
export type DecisaoDoBloco = { aprovadas: number; gravadas: PropostaNaSaida[] }

export type DadosDoRelatorio = {
  nome: string
  resposta: RespostaDoRelatorio
  run: ResumoDoRun
  etapas: RunEtapa[]
  pensamentos: Pensamento[]
  disclaimer: string
  // Só a conversa tem caminho e interpretação; sem eles, o bloco Entendi não aparece.
  caminho?: Caminho
  interpretacao?: Interpretacao
  // Nome de quem o Evitar cita; padrão: o próprio valor.
  nomeDoEvitar?: (item: EvitarItem) => string
  // Pausas do run, na ordem em que aconteceram; sem pausa, não há blocos Pergunta.
  perguntas?: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]
  // Decisão do bloco de aprovação; sem ela, o bloco ficou aberto.
  decisao?: DecisaoDoBloco
  // Itens da casa depois do run; aparecem quando uma casa.propor foi gravada.
  minhaCasa?: { nome: string; estado: "tem" | "acabou" }[]
  // Segunda mensagem da conversa (com `depois`), com o relatório do seu run.
  depois?: { mensagem: string; relatorio: DadosDoRelatorio }
  // Resumo de rotina em uso: o lido antes da mensagem (no `depois`, o lido depois da decisão do bloco). Sem texto, não aparece.
  rotina?: { versao: number; texto: string }
  // Padrões da conta depois da decisão do bloco; sem nenhum, a seção não aparece.
  padroes?: { frase: string; status: StatusPadrao }[]
  // Retornos aguardando da conta depois da rodada, mais recente primeiro.
  comoFicou?: { titulo: string }[]
  // O que a entrega e a lista gravaram: faltas somadas, itens marcados como sugeridos e a lista Para ter em casa.
  gravado?: { faltas: number; sugeridos: number; lista: { nome: string; motivo: string }[] }
  // Uma linha por toque da pessoa (ver linhaDoToque).
  toques?: string[]
  // Motivos do Juiz no run (ver motivosDoJuizDasEtapas); sem eles, a linha do Juiz não mostra motivos.
  motivosDoJuiz?: string[]
}

// Toque já traduzido para o relatório: `numero` é a posição na sugestão ou no retorno, a partir de 1.
export type TocadoDoRelatorio =
  | { tipo: "retorno"; numero: number; resultado: Resultado; semeado: boolean }
  | { tipo: "gosto"; nome: string; gosto: "gosta" | "nao_gosta" | null }
  | {
      tipo: "troca"
      motivo: MotivoDaTroca
      nome: string
      numero: number
      pergunta?: { texto: string; resposta?: "tenho" | "nao_tenho" }
      // A frase da troca, o texto de sem substituto ou vazio quando a troca ainda espera a resposta.
      desfecho?: string
    }

type Item = SugestaoEntregue["itens"][number]
type Para = NonNullable<SaidaDoAcompanhante["para_ter"]>

const ROTULO_DA_ACAO: Record<"tem" | "acabou", string> = { tem: "tem", acabou: "acabou" }

const modelosDoRun = z.object({
  decisao: z.array(z.string()).optional(),
  apoio: z.array(z.string()).optional(),
  reforco: z.array(z.string()).optional(),
})

function listaDeModelos(lista: string[]): string {
  return lista.length > 0 ? lista.join(", ") : "nenhum"
}

function modelosDe(modelos: unknown): { decisao: string[]; apoio: string[]; reforco: string[] } {
  const lidos = modelosDoRun.safeParse(modelos)
  if (!lidos.success) return { decisao: [], apoio: [], reforco: [] }
  return {
    decisao: lidos.data.decisao ?? [],
    apoio: lidos.data.apoio ?? [],
    reforco: lidos.data.reforco ?? [],
  }
}

// Motivos do Juiz (D23): o que vem depois de `reprovado: ` e de `registros: ` nos resumos das etapas juiz, sem repetir.
export function motivosDoJuizDasEtapas(etapas: RunEtapa[]): string[] {
  const motivos = etapas.filter((e) => e.tipo === "juiz").flatMap((e) => motivosDoResumo(e.resumo))
  return [...new Set(motivos)]
}

// Os motivos de um resumo do Juiz: "reprovado: a, b; registros: c" dá a, b, c. Aparam-se as partes, e vazio não conta.
const PARTE_COM_MOTIVOS = /^(?:reprovado|registros): (.+)$/

function motivosDoResumo(resumo: string | null): string[] {
  return (resumo ?? "").split(";").flatMap((parte) => {
    const achado = PARTE_COM_MOTIVOS.exec(parte.trim())
    return (achado?.[1] ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m !== "")
  })
}

// Linha do Juiz (D23): só quando houve tentativa; os motivos aparecem quando há.
function linhaDoJuiz(run: ResumoDoRun, motivos: string[]): string[] {
  if (run.juiz_tentativas === 0) return []
  const veredito =
    run.juiz_aprovado === null ? "indisponivel" : run.juiz_aprovado ? "aprovado" : "reprovado"
  const fim = motivos.length > 0 ? `; motivos: ${motivos.join(", ")}` : ""
  return [`  juiz: ${run.juiz_tentativas} tentativa(s), ${veredito}${fim}`]
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

// Um bloco por pausa: a pergunta com as opções e a linha com a resposta usada.
function blocoDaPergunta(p: { pergunta: Pergunta; resposta: RespostaDaPessoa }): string[] {
  return [
    "Pergunta",
    ...formatarPergunta(p.pergunta)
      .split("\n")
      .map((linha) => `  ${linha}`),
    `  Resposta: ${textoDaResposta(p.pergunta, p.resposta)}`,
  ]
}

function secaoResposta(texto: string): string[] {
  return ["Resposta", ...texto.split("\n").map((linha) => `  ${linha}`)]
}

// O que foi gravado: o texto de cada proposta, ou "nada".
function linhasDoGravado(gravadas: PropostaNaSaida[]): string[] {
  if (gravadas.length === 0) return ["Gravado: nada"]
  return ["Gravado:", ...gravadas.map((g) => `  - ${g.texto}`)]
}

// Minha casa só aparece quando a pessoa aprovou alguma linha da casa.
function secaoMinhaCasa(
  gravadas: PropostaNaSaida[],
  minhaCasa: DadosDoRelatorio["minhaCasa"],
): string[] {
  if (!minhaCasa || !gravadas.some((g) => g.tool === "casa.propor")) return []
  if (minhaCasa.length === 0) return ["Minha casa: vazia"]
  return ["Minha casa:", ...minhaCasa.map((i) => `  - ${i.nome} (${ROTULO_DA_ACAO[i.estado]})`)]
}

// "Agora não" quando nada foi marcado; senão, quantas foram anotadas de quantas.
function linhasDaDecisao(d: DecisaoDoBloco, total: number): string[] {
  if (d.aprovadas === 0) return ["Decisão: Agora não", ...linhasDoGravado([])]
  return [`Decisão: Anotar ${d.gravadas.length} de ${total}`, ...linhasDoGravado(d.gravadas)]
}

// O bloco vem depois da resposta: as linhas, a decisão e o gravado. Sem decisão, fica aberto.
function secaoDoBloco(d: DadosDoRelatorio): string[] {
  const propostas = d.resposta.saida?.propostas ?? []
  if (propostas.length === 0) return []
  if (!d.decisao) return [formatarBloco(propostas), "Bloco aberto"]
  return [
    formatarBloco(propostas),
    ...linhasDaDecisao(d.decisao, propostas.length),
    ...secaoMinhaCasa(d.decisao.gravadas, d.minhaCasa),
  ]
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

function secaoResumo(
  resposta: RespostaDoRelatorio,
  run: ResumoDoRun,
  motivosDoJuiz: string[],
): string[] {
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
    ...(modelos.reforco.length > 0 ? [`  reforço: ${listaDeModelos(modelos.reforco)}`] : []),
    ...(modelos.apoio.length > 0 ? [`  apoio: ${listaDeModelos(modelos.apoio)}`] : []),
    `  trocas de modelo: ${run.trocas_de_modelo}`,
    ...linhaDoJuiz(run, motivosDoJuiz),
    `  trace_id: ${run.trace_id ?? "nenhum"}`,
  ]
}

const nomeSemMudar = (item: EvitarItem): string => item.valor

const RESULTADO_DO_RETORNO: Record<Resultado, string> = {
  ajudou: "Ajudou",
  nao_ajudou: "Não ajudou",
  nao_fez: "Não fiz",
}

const ROTULO_DA_TROCA: Record<MotivoDaTroca, string> = {
  trocar: "Trocar",
  nao_tenho: "Não tenho",
  nao_gosto: "Não gosto",
}

// Motivo da linha da lista Para ter em casa (D13): o texto da tela Minha casa, montado só no relatório.
export function motivoDaLista(item: Pick<ItemDaLista, "motivo" | "detalhe">): string {
  if (item.motivo === "fez_falta") return `Fez falta ${item.detalhe} vezes nos últimos 30 dias`
  return `Faltou para ${item.detalhe}`
}

// A frase da troca fica no item que trocou: o do alimento que saiu (primeira troca) ou o que traz
// esse alimento entre os anteriores (troca seguinte). Sem troca no item, a frase é vazia.
export function fraseDaTrocaNaSugestao(
  sugestao: { itens: { alimento_id: string; troca?: { frase: string; anteriores: string[] } }[] },
  alimentoSaiu: string,
): string {
  const item = sugestao.itens.find(
    (i) =>
      i.troca !== undefined &&
      (i.alimento_id === alimentoSaiu || i.troca.anteriores.includes(alimentoSaiu)),
  )
  return item?.troca?.frase ?? ""
}

function linhaDoRetorno(t: Extract<TocadoDoRelatorio, { tipo: "retorno" }>): string {
  const rotulo = t.semeado ? "Retorno semeado" : "Retorno da sugestão"
  return `${rotulo} ${t.numero}: ${RESULTADO_DO_RETORNO[t.resultado]}`
}

function rotuloDoGosto(gosto: "gosta" | "nao_gosta" | null): string {
  if (gosto === null) return "limpou"
  return gosto === "gosta" ? "gosta" : "não gosta"
}

// A pergunta da troca, com a resposta quando a pessoa respondeu.
function textoDaPergunta(
  p: NonNullable<Extract<TocadoDoRelatorio, { tipo: "troca" }>["pergunta"]>,
): string {
  if (!p.resposta) return `Pergunta: ${p.texto}`
  return `Pergunta: ${p.texto} → ${p.resposta === "tenho" ? "Tenho" : "Não tenho"}`
}

function linhaDaTroca(t: Extract<TocadoDoRelatorio, { tipo: "troca" }>): string {
  const cabeca = `${ROTULO_DA_TROCA[t.motivo]} ${t.nome} na sugestão ${t.numero}:`
  const partes = [
    ...(t.pergunta ? [textoDaPergunta(t.pergunta)] : []),
    ...(t.desfecho ? [t.desfecho] : []),
  ]
  return partes.length > 0 ? `${cabeca} ${partes.join(" · ")}` : cabeca
}

// Uma linha por toque: o retorno, o gosto ou a troca, com o que o toque devolveu.
export function linhaDoToque(t: TocadoDoRelatorio): string {
  if (t.tipo === "retorno") return linhaDoRetorno(t)
  if (t.tipo === "gosto") return `Gosto de ${t.nome}: ${rotuloDoGosto(t.gosto)}`
  return linhaDaTroca(t)
}

// Rotina em uso: a versão e o texto do resumo. Sem texto, a seção não aparece.
function secaoRotina(rotina: DadosDoRelatorio["rotina"]): string[] {
  if (!rotina || rotina.texto.trim() === "") return []
  return ["Rotina", `  v${rotina.versao}: ${rotina.texto}`]
}

// Padrões da conta: uma linha por padrão, com a frase e o status.
function secaoPadroes(padroes: DadosDoRelatorio["padroes"]): string[] {
  if (!padroes || padroes.length === 0) return []
  return ["Padrões", ...padroes.map((p) => `  ${p.frase} · ${p.status}`)]
}

function secaoComoFicou(comoFicou: DadosDoRelatorio["comoFicou"]): string[] {
  if (!comoFicou || comoFicou.length === 0) return []
  return ["Como ficou?", ...comoFicou.map((r) => `  ${r.titulo}`)]
}

// Contagem com o singular quando é 1: "1 falta", "3 faltas".
function contagem(n: number, singular: string, plurais: string): string {
  return `${n} ${n === 1 ? singular : plurais}`
}

// Sem faltas, sugeridos nem lista, a seção não aparece: o relatório fica igual ao de antes.
function secaoGravado(gravado: DadosDoRelatorio["gravado"]): string[] {
  if (!gravado) return []
  const linhas = [
    ...(gravado.faltas > 0 ? [`  ${contagem(gravado.faltas, "falta", "faltas")}`] : []),
    ...(gravado.sugeridos > 0
      ? [
          `  ${contagem(gravado.sugeridos, "item marcado como sugerido", "itens marcados como sugeridos")}`,
        ]
      : []),
    ...(gravado.lista.length > 0
      ? ["  Lista Para ter em casa:", ...gravado.lista.map((i) => `    - ${i.nome} · ${i.motivo}`)]
      : []),
  ]
  return linhas.length > 0 ? ["Gravado", ...linhas] : []
}

function secaoToques(toques: DadosDoRelatorio["toques"]): string[] {
  if (!toques || toques.length === 0) return []
  return ["Toques", ...toques.map((linha) => `  ${linha}`)]
}

// Função pura: não imprime. O script decide o que mostrar e o código de saída.
export function formatarRelatorio(d: DadosDoRelatorio): string {
  const { resposta, run } = d
  const saida = resposta.saida
  const nomeDoEvitar = d.nomeDoEvitar ?? nomeSemMudar
  const blocos = [
    [`Cenário: ${d.nome}`],
    secaoEntendi(d.caminho, d.interpretacao, nomeDoEvitar),
    secaoEtapas(d.etapas, d.pensamentos),
    ...(d.perguntas ?? []).map(blocoDaPergunta),
    secaoRotina(d.rotina),
    secaoResposta(saida?.resposta ?? ""),
    secaoDoBloco(d),
    secaoPadroes(d.padroes),
    secaoComoFicou(d.comoFicou),
    secaoGravado(d.gravado),
    secaoToques(d.toques),
    secaoSugestoes(saida?.sugestoes ?? []),
    secaoEvitar(saida?.evitar ?? []),
    secaoValeTerEmCasa(saida?.para_ter),
    secaoAvisos(saida?.avisos ?? []),
    [d.disclaimer],
    secaoResumo(resposta, run, d.motivosDoJuiz ?? []),
  ]
  const principal = blocos
    .filter((bloco) => bloco.length > 0)
    .map((bloco) => bloco.join("\n"))
    .join("\n\n")
  if (!d.depois) return principal
  return [principal, `Depois: ${d.depois.mensagem}`, formatarRelatorio(d.depois.relatorio)].join(
    "\n\n",
  )
}
