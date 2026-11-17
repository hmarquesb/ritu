import { textosComoPensei } from "@config/index"
import { z } from "zod"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { fraseDoEstado } from "@/core/patterns/textos"
import { conteudoDaPropostaSchema } from "@/core/proposals/conteudo"
import type { Proposta } from "@/core/proposals/ports"
import { textoDaProposta } from "@/core/proposals/textos"
import type { Run, RunEtapa } from "@/core/runs/ports"
import { diaLocal, diasAtras } from "@/core/time/dia-local"

export type TipoDoPasso =
  | "entendi"
  | "cuidado"
  | "clima"
  | "casa"
  | "lembrei"
  | "base"
  | "retorno"
  | "conferi"
  | "perguntei"
  | "propus"
  | "aprovacao"
  | "memoria"
  | "revisao"
  | "troca"
  | "erro"
  | "fim"

export type PassoNaTela = {
  tipo: TipoDoPasso
  frase: string
  detalhe?: string
  marca?: "corrigido" | "falhou"
  tecnico: { modelo?: string; tokens_entrada?: number; tokens_saida?: number; duracao_ms?: number }
}

export type TotalDoRun = {
  passos: number
  latencia_ms: number
  tokens_entrada: number
  tokens_saida: number
  modelos: { papel: string; modelos: string[] }[]
  trocas_de_modelo: number
  prompt_versao: string | null
  juiz_tentativas: number
}

export type LinhaDoTempo =
  | { estado: "aberto" }
  | { estado: "sem_rastro" }
  | { estado: "pronto"; quando: string; passos: PassoNaTela[]; total: TotalDoRun }

type Corpo = { tipo: TipoDoPasso; frase: string; detalhe?: string; marca?: PassoNaTela["marca"] }

type Contexto = {
  run: Run
  kb: KnowledgeBase
  propostas: Proposta[]
  recusouAntes: boolean
  usadasPorTool: Record<string, number>
}

const T = textosComoPensei.passos

const clima = z.object({
  temperatura_aparente: z.number(),
  umidade: z.number(),
  gunas: z.array(z.string()).optional(),
})

const saidaDoRun = z.object({
  origem: z.enum(["agente", "segura", "sem_modelo", "codigo"]),
  sugestoes: z.array(z.unknown()).optional(),
})

function formatar(modelo: string, valores: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (marca, nome: string) => valores[nome] ?? marca)
}

function palavra(mapa: Record<string, string>, chave: string): string | undefined {
  return Object.hasOwn(mapa, chave) ? mapa[chave] : undefined
}

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("")
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
}

function semPontoFinal(texto: string): string {
  return texto.replace(/\.+$/, "")
}

// Nome da guna como a tela mostra (vocabulario.yaml); guna fora do vocabulário sai pelo id.
function nomeDaGuna(guna: string, kb: KnowledgeBase): string {
  return kb.vocabulario.find((v) => v.guna === guna)?.nome ?? guna
}

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
}

function horaNoFuso(d: Date, fuso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: fuso,
  }).formatToParts(d)
  const hora = partes.find((p) => p.type === "hour")?.value ?? "0"
  const minuto = partes.find((p) => p.type === "minute")?.value ?? "00"
  return `${Number(hora)}:${minuto}`
}

function dataCurta(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number)
  const partes = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, diaDoMes ?? 1, 12)))
  const dia2 = partes.find((p) => p.type === "day")?.value ?? ""
  const mes2 = partes.find((p) => p.type === "month")?.value ?? ""
  return `${dia2} ${mes2}`
}

function quandoDoRun(run: Run, agora: Date, fuso: string): string {
  const hoje = diaLocal(agora, fuso)
  let dia: string
  if (run.dia === hoje) dia = textosComoPensei.dia.hoje
  else if (run.dia === diasAtras(hoje, 1)) dia = textosComoPensei.dia.ontem
  else dia = formatar(textosComoPensei.dia.data, { data: dataCurta(run.dia) })
  return formatar(textosComoPensei.quando, { dia, hora: horaNoFuso(new Date(run.criado_em), fuso) })
}

function tecnicoDe(e: RunEtapa): PassoNaTela["tecnico"] {
  return {
    ...(e.modelo ? { modelo: e.modelo } : {}),
    ...(e.tokens_entrada > 0 ? { tokens_entrada: e.tokens_entrada } : {}),
    ...(e.tokens_saida > 0 ? { tokens_saida: e.tokens_saida } : {}),
    ...(e.duracao_ms > 0 ? { duracao_ms: e.duracao_ms } : {}),
  }
}

function montarPasso(c: Corpo, e?: RunEtapa): PassoNaTela {
  const marca = c.marca ?? (e?.status === "falhou" ? "falhou" : undefined)
  return {
    tipo: c.tipo,
    frase: c.frase,
    ...(c.detalhe ? { detalhe: c.detalhe } : {}),
    ...(marca ? { marca } : {}),
    tecnico: e ? tecnicoDe(e) : {},
  }
}

// --- interprete, guardrail, clima e ferramentas de leitura ---

function corpoDoInterprete(e: RunEtapa, ctx: Contexto): Corpo | undefined {
  const nomes = (e.resumo ?? "")
    .split(",")
    .map((id) => palavra(textosComoPensei.intencoes, id.trim()))
    .filter((n): n is string => n !== undefined)
  if (nomes.length === 0) return undefined
  const estados = (ctx.run.momento?.estados ?? [])
    .map((id) => fraseDoEstado(id))
    .filter((n): n is string => n !== undefined)
  return {
    tipo: "entendi",
    frase: formatar(T.entendi.intencoes, { intencoes: juntar(nomes) }),
    ...(estados.length > 0
      ? { detalhe: formatar(T.entendi.estados, { estados: juntar(estados) }) }
      : {}),
  }
}

function corpoDoGuardrail(e: RunEtapa): Corpo | undefined {
  if (e.nome === "alerta_fisico" || e.nome === "alerta_emocional")
    return { tipo: "cuidado", frase: T.cuidado }
  if (e.nome === "injection") return { tipo: "cuidado", frase: T.injection }
  return undefined
}

function corpoDoClimaAgora(e: RunEtapa, ctx: Contexto): Corpo | undefined {
  if (e.resumo === "sem cidade") return { tipo: "clima", frase: T.clima.semCidade }
  if (e.resumo === "indisponível") return { tipo: "clima", frase: T.clima.indisponivel }
  if (e.resumo !== "ok") return undefined
  const lido = clima.safeParse(ctx.run.clima_usado)
  if (!lido.success) return undefined
  const frase = formatar(T.clima.agora, {
    temperatura: formatarNumero(lido.data.temperatura_aparente),
    umidade: formatarNumero(lido.data.umidade),
  })
  const nomes = (lido.data.gunas ?? []).map((g) => nomeDaGuna(g, ctx.kb))
  return {
    tipo: "clima",
    frase,
    ...(nomes.length > 0 ? { detalhe: formatar(T.clima.gunas, { gunas: juntar(nomes) }) } : {}),
  }
}

function corpoDaTool(e: RunEtapa, ctx: Contexto): Corpo | undefined {
  if (e.nome === "clima.agora") return corpoDoClimaAgora(e, ctx)
  if (e.nome === "clima.proximas_horas") return { tipo: "clima", frase: T.clima.proximasHoras }
  if (e.nome === "preferencias.ler") return { tipo: "lembrei", frase: T.lembrei.preferencias }
  if (e.nome === "resultado.registrar") return { tipo: "retorno", frase: T.retorno.anotado }
  if (!e.resumo) return undefined
  if (e.nome === "casa.ler")
    return { tipo: "casa", frase: formatar(T.casa.ler, { resumo: e.resumo }) }
  if (e.nome === "historico.recente") {
    return { tipo: "lembrei", frase: formatar(T.lembrei.historico, { resumo: e.resumo }) }
  }
  if (e.nome.startsWith("ayurveda.")) {
    return { tipo: "base", frase: formatar(T.base.ayurveda, { resumo: e.resumo }) }
  }
  return undefined
}

// --- validação e juiz ---

function corpoDaValidacao(e: RunEtapa, ctx: Contexto): Corpo | undefined {
  if (e.status === "ok" && e.resumo === "ok") {
    const frase = ctx.recusouAntes ? T.conferi.corrigido : T.conferi.tudoCerto
    return { tipo: "conferi", frase }
  }
  if (e.status !== "recusado" || !e.resumo) return undefined
  const conhecidos = e.resumo
    .split(",")
    .map((c) => palavra(textosComoPensei.codigosValidacao, c.trim()))
    .filter((p): p is string => p !== undefined)
  const n = conhecidos.length
  if (n === 0) return undefined
  const frase = n === 1 ? T.conferi.umProblema : formatar(T.conferi.problemas, { n: String(n) })
  return { tipo: "conferi", frase, detalhe: conhecidos.join("; "), marca: "corrigido" }
}

type VereditoDoJuiz = {
  tipo: "aprovado" | "nota" | "reprovado" | "indisponivel"
  motivos: string[]
}

function vereditoDoJuiz(resumo: string | null): VereditoDoJuiz | undefined {
  if (!resumo) return undefined
  if (resumo === "indisponivel") return { tipo: "indisponivel", motivos: [] }
  if (resumo === "aprovado") return { tipo: "aprovado", motivos: [] }
  if (resumo.startsWith("aprovado; registros")) return { tipo: "nota", motivos: [] }
  if (!resumo.startsWith("reprovado: ")) return undefined
  const motivos = resumo.slice("reprovado: ".length).split("; registros:")[0] ?? ""
  return {
    tipo: "reprovado",
    motivos: motivos
      .split(",")
      .map((m) => palavra(textosComoPensei.motivosJuiz, m.trim()))
      .filter((m): m is string => m !== undefined),
  }
}

function corpoDoJuiz(e: RunEtapa): Corpo | undefined {
  const v = vereditoDoJuiz(e.resumo)
  if (!v) return undefined
  if (v.tipo === "indisponivel")
    return { tipo: "revisao", frase: T.revisao.indisponivel, marca: "falhou" }
  if (v.tipo === "aprovado") return { tipo: "revisao", frase: T.revisao.aprovada }
  if (v.tipo === "nota") return { tipo: "revisao", frase: T.revisao.comNota }
  const detalhe = v.motivos.length > 0 ? v.motivos.join("; ") : undefined
  return {
    tipo: "revisao",
    frase: T.revisao.reprovada,
    ...(detalhe ? { detalhe } : {}),
    marca: "corrigido",
  }
}

// --- perguntas, propostas e memória ---

function corpoDaPergunta(e: RunEtapa): Corpo | undefined {
  if (e.resumo === "come") return { tipo: "perguntei", frase: T.perguntei.come }
  if (e.resumo === "variante") return { tipo: "perguntei", frase: T.perguntei.variante }
  const n = /^casa: (\d+)/.exec(e.resumo ?? "")?.[1]
  return n ? { tipo: "perguntei", frase: formatar(T.perguntei.casa, { n }) } : undefined
}

const DECISAO: Record<Proposta["decisao"], string | undefined> = {
  aprovada: T.propus.aprovou,
  recusada: T.propus.naoAprovou,
  expirada: T.propus.expirou,
  pendente: undefined,
}

function corpoDaProposta(e: RunEtapa, ctx: Contexto): Corpo | undefined {
  const indice = ctx.usadasPorTool[e.nome] ?? 0
  ctx.usadasPorTool[e.nome] = indice + 1
  const proposta = ctx.propostas.filter((p) => p.tool === e.nome)[indice]
  if (!proposta) return undefined
  const conteudo = conteudoDaPropostaSchema.safeParse(proposta.conteudo)
  if (!conteudo.success) return undefined
  const texto = semPontoFinal(textoDaProposta(conteudo.data, ctx.kb))
  const decisao = DECISAO[proposta.decisao]
  return {
    tipo: "propus",
    frase: formatar(T.propus.texto, { texto }),
    ...(decisao ? { detalhe: decisao } : {}),
  }
}

function corpoDaMemoria(e: RunEtapa): Corpo | undefined {
  return e.nome === "resumo_de_rotina" ? { tipo: "memoria", frase: T.memoria.rotina } : undefined
}

function corpoDaAprovacao(e: RunEtapa): Corpo | undefined {
  return e.resumo
    ? { tipo: "aprovacao", frase: formatar(T.aprovacao.aprovou, { resumo: e.resumo }) }
    : undefined
}

function corpoDaTroca(e: RunEtapa): Corpo | undefined {
  if (e.resumo === "cota") return { tipo: "troca", frase: T.troca.cota }
  if (e.resumo === "429") return { tipo: "troca", frase: T.troca.indisponivel }
  return undefined
}

const ROTEIRO: Record<string, (e: RunEtapa, ctx: Contexto) => Corpo | undefined> = {
  interprete: corpoDoInterprete,
  guardrail: corpoDoGuardrail,
  tool: corpoDaTool,
  validacao: corpoDaValidacao,
  juiz: corpoDoJuiz,
  pergunta: corpoDaPergunta,
  proposta: corpoDaProposta,
  aprovacao: corpoDaAprovacao,
  memoria: corpoDaMemoria,
  troca_de_modelo: corpoDaTroca,
  erro: () => ({ tipo: "erro", frase: T.erro, marca: "falhou" }),
}

// Uma etapa vira no máximo um passo. Falha sem frase vira passo de erro; sucesso sem frase não vira passo.
function passoDe(e: RunEtapa, ctx: Contexto): PassoNaTela | undefined {
  const corpo = ROTEIRO[e.tipo]?.(e, ctx)
  if (corpo) return montarPasso(corpo, e)
  if (e.status === "falhou") return montarPasso({ tipo: "erro", frase: T.erro, marca: "falhou" }, e)
  return undefined
}

// --- último passo ---

function fimDoRun(run: Run): Corpo | undefined {
  if (run.fora_da_conversa) return { tipo: "fim", frase: textosComoPensei.apagada }
  if (run.status === "failed") return { tipo: "fim", frase: T.fim.falhou }
  if (run.status === "expired") return { tipo: "fim", frase: T.fim.expirou }
  if (run.status === "cancelled") return { tipo: "fim", frase: T.fim.cancelado }
  if (run.status !== "done") return undefined
  return { tipo: "fim", frase: fraseDaSaida(run.saida) }
}

function fraseDaSaida(saida: unknown): string {
  const lida = saidaDoRun.safeParse(saida)
  if (!lida.success) return T.fim.semSugestoes
  const { origem } = lida.data
  if (origem === "segura") return T.fim.segura
  if (origem === "sem_modelo") return T.fim.semModelo
  if (origem === "codigo") return T.fim.codigo
  const n = lida.data.sugestoes?.length ?? 0
  if (n === 0) return T.fim.semSugestoes
  if (n === 1) return T.fim.umaSugestao
  return formatar(T.fim.comSugestoes, { n: String(n) })
}

function modelosDo(m: unknown): TotalDoRun["modelos"] {
  if (!m || typeof m !== "object" || Array.isArray(m)) return []
  return Object.entries(m).flatMap(([papel, lista]) =>
    Array.isArray(lista)
      ? [{ papel, modelos: lista.filter((x): x is string => typeof x === "string") }]
      : [],
  )
}

function totalDo(run: Run): TotalDoRun {
  return {
    passos: run.passos,
    latencia_ms: run.latencia_ms,
    tokens_entrada: run.tokens_entrada,
    tokens_saida: run.tokens_saida,
    modelos: modelosDo(run.modelos),
    trocas_de_modelo: run.trocas_de_modelo,
    prompt_versao: run.prompt_versao,
    juiz_tentativas: run.juiz_tentativas,
  }
}

function passosDoRun(etapas: RunEtapa[], ctx: Contexto): PassoNaTela[] {
  const passos: PassoNaTela[] = []
  for (const e of [...etapas].sort((a, b) => a.ordem - b.ordem)) {
    if (e.tipo !== "llm") {
      const passo = passoDe(e, ctx)
      if (passo) passos.push(passo)
    }
    if (e.tipo === "validacao" && e.status === "recusado") ctx.recusouAntes = true
  }
  return passos
}

/** Transforma as etapas de um run na linha do tempo da tela Como pensei. Pura e sem lançar. */
export function linhaDoTempo(p: {
  run: Run
  etapas: RunEtapa[]
  propostas: Proposta[]
  kb: KnowledgeBase
  agora: Date
  fuso: string
}): LinhaDoTempo {
  const { run, etapas } = p
  if (run.status === "running") return { estado: "aberto" }
  if (run.status.startsWith("waiting") && etapas.length === 0) return { estado: "aberto" }
  if (etapas.length === 0) return { estado: "sem_rastro" }
  const ctx: Contexto = {
    run,
    kb: p.kb,
    propostas: p.propostas,
    recusouAntes: false,
    usadasPorTool: {},
  }
  const passos = passosDoRun(etapas, ctx)
  const fim = fimDoRun(run)
  if (fim) passos.push(montarPasso(fim))
  return {
    estado: "pronto",
    quando: quandoDoRun(run, p.agora, p.fuso),
    passos,
    total: totalDo(run),
  }
}
