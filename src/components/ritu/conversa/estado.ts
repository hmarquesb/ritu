import type { ConversaDoDia, FalaNaTela } from "@/core/conversation/do-dia"
import type { FraseDeEtapa } from "@/core/conversation/etapas"
import type { EventoDaTela } from "@/core/conversation/eventos"
import type { VisaoDoRun } from "@/core/conversation/visao"
import type { EstadoDosLimites } from "@/core/limits/estado"

export type EstadoDaConversa = {
  falas: FalaNaTela[]
  runs: Record<string, VisaoDoRun>
  aberto?: { run_id: string; status: VisaoDoRun["status"] }
  pendentes: number
  caixa: { texto: string; atalhos: string[]; respondendo: boolean }
  aoVivo?: { run_id?: string; frases: FraseDeEtapa[] }
  erro?: { codigo: string; texto?: string; atalhos: string[] }
  anuncio?: string
  // A mensagem enviada e ainda sem run: volta para a caixa se o envio falhar.
  enviado?: { texto: string; atalhos: string[] }
  limites: EstadoDosLimites
  // O texto escrito quando o envio foi barrado pelo limite (só em memória).
  textoGuardado?: string
}

export type AcaoDaConversa =
  | { tipo: "enviou"; texto: string; mensagem: { texto?: string; atalhos: string[] } }
  | { tipo: "retomou" }
  | { tipo: "evento"; evento: EventoDaTela }
  | { tipo: "falhou"; codigo?: string }
  | { tipo: "barrou"; limites: EstadoDosLimites }
  | { tipo: "desfez" }
  | { tipo: "visao"; visao: VisaoDoRun; pendentes?: number }
  | { tipo: "digitou"; texto: string }
  | { tipo: "marcou"; atalhos: string[] }

const ID_OTIMISTA = "otimista"
const ABERTOS = new Set<string>(["running", "waiting_for_input", "waiting_for_approval"])

export function inicial(c: ConversaDoDia): EstadoDaConversa {
  return {
    falas: c.falas,
    runs: c.runs,
    aberto: c.aberto,
    pendentes: c.pendentes,
    caixa: { texto: c.mensagem_sugerida ?? "", atalhos: [], respondendo: false },
    limites: c.limites,
  }
}

// Rótulos dos atalhos e o texto livre, como a pessoa vai ver a própria fala.
export function textoOtimista(
  mensagem: { texto?: string; atalhos: string[] },
  rotulos: Record<string, string>,
): string {
  const partes: string[] = []
  const atalhos = mensagem.atalhos.map((id) => rotulos[id] ?? id).join(" · ")
  if (atalhos) partes.push(atalhos)
  if (mensagem.texto) partes.push(mensagem.texto)
  return partes.join("\n")
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

export function visaoValida(v: unknown): v is VisaoDoRun {
  if (!ehObjeto(v)) return false
  return (
    typeof v.run_id === "string" &&
    typeof v.status === "string" &&
    Array.isArray(v.frases) &&
    Array.isArray(v.sugestoes) &&
    Array.isArray(v.avisos) &&
    Array.isArray(v.evitar)
  )
}

function fraseValida(f: unknown): f is FraseDeEtapa {
  return ehObjeto(f) && typeof f.chave === "string" && f.chave !== "" && typeof f.texto === "string"
}

function aberturaDe(visao: VisaoDoRun): EstadoDaConversa["aberto"] {
  return ABERTOS.has(visao.status) ? { run_id: visao.run_id, status: visao.status } : undefined
}

// Guarda a visão do run e, se ela traz a resposta e a tela ainda não tem a fala do agente, a fala entra.
function comVisao(estado: EstadoDaConversa, visao: VisaoDoRun): EstadoDaConversa {
  const runs = { ...estado.runs, [visao.run_id]: visao }
  const jaTemFala = estado.falas.some((f) => f.autor === "agente" && f.run_id === visao.run_id)
  const nova = visao.resposta !== undefined && visao.resposta !== "" && !jaTemFala
  const falas: FalaNaTela[] = nova
    ? [
        ...estado.falas,
        {
          autor: "agente",
          id: `agente-${visao.run_id}`,
          texto: visao.resposta ?? "",
          run_id: visao.run_id,
        },
      ]
    : estado.falas
  let aberto = estado.aberto
  if (aberto === undefined || aberto.run_id === visao.run_id) aberto = aberturaDe(visao)
  return { ...estado, runs, falas, aberto, anuncio: nova ? visao.resposta : estado.anuncio }
}

function semOtimista(falas: FalaNaTela[]): FalaNaTela[] {
  return falas.filter((f) => f.id !== ID_OTIMISTA)
}

function falhar(estado: EstadoDaConversa, codigo: string): EstadoDaConversa {
  const pendente = estado.falas.some((f) => f.id === ID_OTIMISTA) ? estado.enviado : undefined
  const caixa = pendente
    ? { texto: pendente.texto, atalhos: pendente.atalhos, respondendo: false }
    : { ...estado.caixa, respondendo: false }
  return {
    ...estado,
    falas: semOtimista(estado.falas),
    caixa,
    aoVivo: undefined,
    enviado: undefined,
    erro: { codigo, texto: pendente?.texto, atalhos: pendente?.atalhos ?? [] },
  }
}

function aoFim(
  estado: EstadoDaConversa,
  evento: Omit<Extract<EventoDaTela, { tipo: "fim" }>, "limites"> & { limites?: EstadoDosLimites },
): EstadoDaConversa {
  if (!visaoValida(evento.visao)) return falhar(estado, "inesperado")
  const base = comVisao(estado, evento.visao)
  const limpa = estado.enviado !== undefined
  return {
    ...base,
    pendentes: typeof evento.pendentes === "number" ? evento.pendentes : base.pendentes,
    caixa: limpa
      ? { texto: "", atalhos: [], respondendo: false }
      : { ...base.caixa, respondendo: false },
    aoVivo: undefined,
    enviado: undefined,
    erro: undefined,
    limites: evento.limites ?? estado.limites,
  }
}

function barrar(estado: EstadoDaConversa, limites: EstadoDosLimites): EstadoDaConversa {
  const pendente = estado.falas.some((f) => f.id === ID_OTIMISTA) ? estado.enviado : undefined
  return {
    ...estado,
    falas: semOtimista(estado.falas),
    caixa: { ...estado.caixa, respondendo: false },
    aoVivo: undefined,
    enviado: undefined,
    erro: undefined,
    limites,
    textoGuardado: pendente?.texto || estado.textoGuardado,
  }
}

function aoEvento(estado: EstadoDaConversa, evento: EventoDaTela): EstadoDaConversa {
  switch (evento.tipo) {
    case "inicio": {
      if (typeof evento.run_id !== "string") return estado
      const falas = estado.falas.map((f) =>
        f.id === ID_OTIMISTA ? { ...f, id: `pessoa-${evento.run_id}`, run_id: evento.run_id } : f,
      )
      return { ...estado, falas, aoVivo: { run_id: evento.run_id, frases: [] } }
    }
    case "etapa": {
      if (!fraseValida(evento.frase)) return estado
      const atuais = estado.aoVivo?.frases ?? []
      if (atuais.at(-1)?.chave === evento.frase.chave) return estado
      return { ...estado, aoVivo: { ...estado.aoVivo, frases: [...atuais, evento.frase] } }
    }
    case "fim":
      return aoFim(estado, evento)
    case "erro":
      return falhar(estado, typeof evento.erro === "string" ? evento.erro : "inesperado")
    default:
      return estado
  }
}

export function reduzir(estado: EstadoDaConversa, acao: AcaoDaConversa): EstadoDaConversa {
  switch (acao.tipo) {
    case "enviou": {
      const fala: FalaNaTela = { autor: "pessoa", id: ID_OTIMISTA, texto: acao.texto, run_id: null }
      return {
        ...estado,
        falas: [...semOtimista(estado.falas), fala],
        caixa: { ...estado.caixa, respondendo: true },
        aoVivo: { frases: [] },
        erro: undefined,
        anuncio: undefined,
        enviado: { texto: acao.mensagem.texto ?? "", atalhos: acao.mensagem.atalhos },
      }
    }
    case "retomou":
      return {
        ...estado,
        caixa: { ...estado.caixa, respondendo: true },
        aoVivo: { frases: [] },
        erro: undefined,
        anuncio: undefined,
        enviado: undefined,
      }
    case "evento":
      return aoEvento(estado, acao.evento)
    case "desfez":
      return {
        ...estado,
        falas: semOtimista(estado.falas),
        caixa: { ...estado.caixa, respondendo: false },
        aoVivo: undefined,
        enviado: undefined,
      }
    case "barrou":
      return barrar(estado, acao.limites)
    case "falhou":
      return falhar(estado, acao.codigo ?? "rede")
    case "visao": {
      if (!visaoValida(acao.visao)) return estado
      // A consulta achou o run fora de `running` e o fluxo não trouxe o `fim`: fecha o envio como um `fim`.
      if (acao.visao.status !== "running" && estado.aoVivo?.run_id === acao.visao.run_id) {
        return aoFim(estado, {
          tipo: "fim",
          visao: acao.visao,
          pendentes: acao.pendentes ?? estado.pendentes,
        })
      }
      const base = comVisao(estado, acao.visao)
      return typeof acao.pendentes === "number" ? { ...base, pendentes: acao.pendentes } : base
    }
    case "digitou":
      return { ...estado, caixa: { ...estado.caixa, texto: acao.texto } }
    case "marcou":
      return { ...estado, caixa: { ...estado.caixa, atalhos: acao.atalhos } }
  }
}
