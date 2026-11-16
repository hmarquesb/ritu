import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { FiltroPessoa } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { type ConteudoDaProposta, lerConteudo } from "@/core/proposals/conteudo"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import { padraoVale } from "./vale"

type Deps = { stores: Stores; kb: KnowledgeBase; clock: Clock }

/** Escolhe no máximo um padrão candidato para o bloco de aprovação (o mais antigo que vale e não cansou). */
export async function padraoParaOBloco(
  deps: Deps,
  contaId: string,
  p: { filtro: FiltroPessoa; fuso?: string },
): Promise<ConteudoDaProposta[]> {
  const { stores, kb, clock } = deps
  const candidatos = (await stores.patterns.listar(contaId, "candidato"))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.criado_em.localeCompare(b.c.criado_em) || a.i - b.i)
    .map(({ c }) => c)
    .filter((c) => padraoVale(c, p.filtro, kb))
  if (candidatos.length === 0) return []
  const hoje = diaLocal(clock.now(), p.fuso)
  const vezes = new Map<string, number>()
  const hojeJa = new Set<string>()
  for (const linha of await stores.proposals.porTool(contaId, "padrao.confirmar")) {
    const conteudo = lerConteudo(linha.tool, linha.conteudo)
    if (conteudo?.tool !== "padrao.confirmar") continue
    vezes.set(conteudo.padrao_id, (vezes.get(conteudo.padrao_id) ?? 0) + 1)
    if (diaLocal(new Date(linha.criado_em), p.fuso) === hoje) hojeJa.add(conteudo.padrao_id)
  }
  const escolhido = candidatos.find(
    (c) => !hojeJa.has(c.id) && (vezes.get(c.id) ?? 0) < config.padroes.bloco.vezesSemResposta,
  )
  return escolhido
    ? [{ tool: "padrao.confirmar", padrao_id: escolhido.id, frase: escolhido.frase }]
    : []
}
