import { config, textosComoFicou } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { diaLocal, diasEntre } from "@/core/time/dia-local"
import type { Resultado, Retorno } from "./ports"

const DIA_MS = 86_400_000

type TipoDeSugestao = Retorno["sugestao"]["tipo"]

export type RetornoNaTela = {
  id: string
  tipo: TipoDeSugestao
  titulo: string
  ingredientes: string[] // nomes dos alimentos da base, na ordem; id fora da base fica de fora
  status: "aguardando" | "respondido"
  resultado: Resultado | null
}

export type ComoFicouNaTela = {
  dias: { dia: string; nome: string; retornos: RetornoNaTela[] }[]
  total: number
}

export function retornoNaTela(r: Retorno, kb: KnowledgeBase): RetornoNaTela {
  return {
    id: r.id,
    tipo: r.sugestao.tipo,
    titulo: r.sugestao.titulo,
    ingredientes: r.sugestao.alimentos.flatMap((id) => {
      const alimento = kb.alimento(id)
      return alimento ? [alimento.nome] : []
    }),
    status: r.status,
    resultado: r.resultado,
  }
}

// Agrupa por dia local os retornos aguardando dentro da janela de memória, do mais recente ao mais antigo.
export function visaoComoFicou(p: {
  retornos: Retorno[]
  kb: KnowledgeBase
  agora: Date
  fuso: string
}): ComoFicouNaTela {
  const limite = p.agora.getTime() - config.memoria.retornosDias * DIA_MS
  const hoje = diaLocal(p.agora, p.fuso)
  const recentes = p.retornos
    .filter((r) => r.status === "aguardando" && new Date(r.criado_em).getTime() >= limite)
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

  const porDia = new Map<string, RetornoNaTela[]>()
  for (const r of recentes) {
    const dia = diaLocal(new Date(r.criado_em), p.fuso)
    const lista = porDia.get(dia) ?? []
    lista.push(retornoNaTela(r, p.kb))
    porDia.set(dia, lista)
  }

  // A entrada já vem do mais recente, então o Map guarda os dias nessa ordem.
  const dias = [...porDia].map(([dia, retornos]) => ({ dia, nome: nomeDoDia(dia, hoje), retornos }))
  return { dias, total: recentes.length }
}

function nomeDoDia(dia: string, hoje: string): string {
  const n = Math.max(0, diasEntre(dia, hoje))
  if (n === 0) return textosComoFicou.dia.hoje
  if (n === 1) return textosComoFicou.dia.ontem
  return formatar(textosComoFicou.dia.dias, { n })
}
