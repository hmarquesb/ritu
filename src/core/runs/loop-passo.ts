import { loop } from "@config/loop"
import type { Tool } from "@/core/tools/tool"
import type { ChamadaDeTool, MensagemDoLoop } from "./agent-runtime"
import type { ResultadoDeControle, ToolDeControle } from "./agente"
import type { Ambiente, FimDoTrecho } from "./loop"
import type { NovaEtapa, TipoDeEtapa } from "./ports"

type StatusEtapa = NovaEtapa["status"]

type Despacho = {
  tipo: TipoDeEtapa
  nome: string
  status: StatusEtapa
  resumo?: string
  resultado: unknown
  controle?: ResultadoDeControle
}

const NOME_MAX = 64
const RESUMO_MAX = 80

export function etapaDe(
  e: Pick<NovaEtapa, "tipo" | "nome" | "status" | "duracao_ms"> & Partial<NovaEtapa>,
): NovaEtapa {
  return { resumo: null, modelo: null, tokens_entrada: 0, tokens_saida: 0, ...e }
}

/** Emite `etapa_iniciada` antes do trabalho. */
export function iniciarEtapa(amb: Ambiente, tipo: TipoDeEtapa, nome: string): void {
  amb.deps.aoVivo?.({ tipo: "etapa_iniciada", etapa: { tipo, nome } })
}

/** Grava a etapa e emite `etapa_concluida`. */
export async function registrarEtapa(amb: Ambiente, etapa: NovaEtapa): Promise<void> {
  const gravada = await amb.deps.gravarEtapa(etapa)
  amb.ordemLocal += 1
  const completa = gravada ?? {
    ...etapa,
    run_id: "",
    ordem: amb.ordemLocal,
    criado_em: amb.deps.clock.now().toISOString(),
  }
  amb.deps.aoVivo?.({ tipo: "etapa_concluida", etapa: completa })
}

export function cortarResultado(resultado: unknown): unknown {
  const valor = resultado === undefined ? null : resultado
  let json: string
  try {
    json = JSON.stringify(valor)
  } catch {
    return { erro: "nao_serializavel" }
  }
  if (json.length <= loop.maxResultadoDeToolCaracteres) return valor
  return { cortado: true, parcial: json.slice(0, loop.maxResultadoDeToolCaracteres) }
}

function resumir<O>(tool: Tool<unknown, O>, saida: O): string | undefined {
  try {
    return tool.resumir?.(saida)?.slice(0, RESUMO_MAX)
  } catch {
    return undefined
  }
}

async function rodarTool(amb: Ambiente, tool: Tool<unknown, unknown>, chamada: ChamadaDeTool) {
  const argumentos = tool.input.safeParse(chamada.argumentos)
  if (!argumentos.success) {
    return despacho("tool", tool.name, "recusado", { erro: "argumentos_invalidos" })
  }
  try {
    const saida = await tool.execute(argumentos.data, amb.ctx)
    return despacho("tool", tool.name, "ok", saida, resumir(tool, saida))
  } catch {
    return despacho("tool", tool.name, "falhou", { erro: "falhou" })
  }
}

function despacho(
  tipo: TipoDeEtapa,
  nome: string,
  status: StatusEtapa,
  resultado: unknown,
  resumo?: string,
  controle?: ResultadoDeControle,
): Despacho {
  return { tipo, nome, status, resultado, resumo, controle }
}

function despachoDeControle(r: ResultadoDeControle, nome: string): Despacho {
  if (r.tipo === "entregar") {
    return despacho("validacao", nome, "ok", r.saida, r.resumo?.slice(0, RESUMO_MAX), r)
  }
  if (r.tipo === "recusar") {
    return despacho("validacao", nome, "recusado", r.resultado, r.resumo?.slice(0, RESUMO_MAX), r)
  }
  if (r.tipo === "encerrar") {
    const resultado = { erro: r.codigo }
    return despacho("validacao", nome, "falhou", resultado, r.resumo?.slice(0, RESUMO_MAX), r)
  }
  const tipo = r.pendencia.tipo === "pergunta" ? "pergunta" : "proposta"
  return despacho(tipo, nome, "ok", null, r.resumo?.slice(0, 80), r)
}

async function rodarControle(
  amb: Ambiente,
  ctrl: ToolDeControle<unknown>,
  chamada: ChamadaDeTool,
): Promise<Despacho> {
  const argumentos = ctrl.input.safeParse(chamada.argumentos)
  if (!argumentos.success) {
    return despacho("validacao", ctrl.name, "recusado", { erro: "argumentos_invalidos" })
  }
  try {
    const r = await ctrl.tratar(argumentos.data, amb.ctx, amb.estado)
    return despachoDeControle(r, ctrl.name)
  } catch {
    return despacho("validacao", ctrl.name, "falhou", { erro: "falhou" })
  }
}

async function despachar(amb: Ambiente, chamada: ChamadaDeTool): Promise<Despacho> {
  const tool = amb.agente.tools.find((t) => t.name === chamada.nome)
  if (tool) return rodarTool(amb, tool, chamada)
  const ctrl = amb.agente.controle.find((c) => c.name === chamada.nome)
  if (ctrl) return rodarControle(amb, ctrl, chamada)
  return despacho("erro", chamada.nome.slice(0, NOME_MAX), "recusado", {
    erro: "tool_desconhecida",
  })
}

function nomeConhecido(amb: Ambiente, nome: string): string {
  const conhecida =
    amb.agente.tools.some((t) => t.name === nome) ||
    amb.agente.controle.some((c) => c.name === nome)
  return conhecida ? nome : "desconhecida"
}

async function executarChamada(amb: Ambiente, chamada: ChamadaDeTool): Promise<Despacho> {
  const { telemetry, clock } = amb.deps
  const nomeSpan = nomeConhecido(amb, chamada.nome)
  const ehTool = amb.agente.tools.some((t) => t.name === chamada.nome)
  iniciarEtapa(amb, ehTool ? "tool" : "validacao", nomeSpan)
  const inicio = clock.now().getTime()
  const d = await telemetry.span("tool.chamada", { "tool.nome": nomeSpan }, async (s) => {
    const feito = await despachar(amb, chamada)
    s.atribuir({ "tool.status": feito.status })
    if (feito.status === "falhou") s.falhar("falhou")
    return feito
  })
  telemetry.contador("ritu_tool_chamadas_total", {
    tool: nomeSpan,
    status: d.status,
  })
  telemetry.histograma("ritu_tool_duracao_ms", clock.now().getTime() - inicio, { tool: nomeSpan })
  await registrarEtapa(
    amb,
    etapaDe({
      tipo: d.tipo,
      nome: d.nome,
      status: d.status,
      duracao_ms: clock.now().getTime() - inicio,
      resumo: d.resumo ?? null,
    }),
  )
  return d
}

function mensagemDeTool(chamada: ChamadaDeTool, resultado: unknown): MensagemDoLoop {
  return {
    papel: "tool",
    chamada_id: chamada.id,
    nome: chamada.nome.slice(0, NOME_MAX),
    resultado: cortarResultado(resultado),
  }
}

/** Aplica o efeito de um despacho sobre o estado; devolve o fim do trecho, se houver. */
function aplicarControle(
  amb: Ambiente,
  chamada: ChamadaDeTool,
  d: Despacho,
): FimDoTrecho | undefined {
  const c = d.controle
  if (c?.tipo === "entregar") return { tipo: "entregue", saida: c.saida }
  if (c?.tipo === "encerrar") return { tipo: "erro", codigo: c.codigo }
  if (c?.tipo === "recusar") amb.estado.entregas_recusadas += 1
  if (c?.tipo !== "pausar") return undefined
  amb.deps.telemetry.evento("pausa", { "pausa.tipo": c.pendencia.tipo })
  amb.deps.telemetry.contador("ritu_pausas_total", { tipo: c.pendencia.tipo })
  return {
    tipo: "pausa",
    pendencia: {
      ...c.pendencia,
      chamada_id: chamada.id,
      criada_em: amb.deps.clock.now().toISOString(),
    },
  }
}

/** Executa as chamadas do passo em sequência; devolve o fim do trecho, se houver. */
export async function processarChamadas(
  amb: Ambiente,
  chamadas: ChamadaDeTool[],
): Promise<FimDoTrecho | undefined> {
  let fim: FimDoTrecho | undefined
  for (const [i, chamada] of chamadas.entries()) {
    if (fim) {
      amb.estado.mensagens.push(mensagemDeTool(chamada, { ignorada: true }))
      continue
    }
    if (i >= loop.maxToolsPorPasso) {
      amb.estado.mensagens.push(mensagemDeTool(chamada, { erro: "muitas_tools" }))
      continue
    }
    const d = await executarChamada(amb, chamada)
    fim = aplicarControle(amb, chamada, d)
    if (fim?.tipo === "pausa") continue
    const resultado = fim?.tipo === "entregue" ? { entregue: true } : d.resultado
    amb.estado.mensagens.push(mensagemDeTool(chamada, resultado))
  }
  return fim
}
