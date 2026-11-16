import { config } from "@config/index"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { ReferenciaDeItem } from "@/core/pantry/ports"
import { type ConteudoDaProposta, lerConteudo } from "@/core/proposals/conteudo"
import type { Stores } from "@/core/stores"

type ItemComNome = { alimento_id?: string; nome: string }

function referencia(i: ItemComNome): ReferenciaDeItem {
  return i.alimento_id ? { alimento_id: i.alimento_id } : { nome_livre: i.nome }
}

function idsDaProposta(c: ConteudoDaProposta): string[] {
  if (c.tool === "lista.propor") return [c.alimento_id]
  if (c.tool === "casa.propor")
    return c.itens.flatMap((i) => (i.alimento_id ? [i.alimento_id] : []))
  if (c.tool === "padrao.confirmar") return []
  if (c.tipo === "nao_come") return c.itens.flatMap((i) => (i.alimento_id ? [i.alimento_id] : []))
  if (c.tipo === "gosta") return c.itens.map((i) => i.alimento_id)
  return []
}

function evitarForaDaBase(c: ConteudoDaProposta, kb: KnowledgeBase): boolean {
  if (c.tool !== "memoria.propor" || c.tipo !== "evitar_sempre") return false
  return c.itens.some((i) => {
    if (i.tipo === "alimento") return !kb.alimento(i.valor)
    if (i.tipo === "grupo") return !kb.gruposEvitar.some((g) => g.id === i.valor)
    return false
  })
}

function foraDaBase(c: ConteudoDaProposta, kb: KnowledgeBase): boolean {
  return idsDaProposta(c).some((id) => !kb.alimento(id)) || evitarForaDaBase(c, kb)
}

async function gravarNaoCome(stores: Stores, contaId: string, itens: ItemComNome[]): Promise<void> {
  const atuais = (await stores.profiles.ler(contaId)).nao_come
  const uniao = [...atuais]
  for (const i of itens) {
    const novo = i.alimento_id
      ? { tipo: "alimento" as const, valor: i.alimento_id }
      : { tipo: "texto" as const, valor: i.nome }
    if (!uniao.some((u) => u.tipo === novo.tipo && u.valor === novo.valor)) uniao.push(novo)
  }
  await stores.profiles.definirNaoCome(contaId, uniao)
}

async function gravarMemoria(
  stores: Stores,
  contaId: string,
  c: Extract<ConteudoDaProposta, { tool: "memoria.propor" }>,
): Promise<void> {
  switch (c.tipo) {
    case "evitar_sempre":
      await stores.profiles.acrescentarEvitarSempre(contaId, c.itens)
      return
    case "restricao": {
      const atuais = (await stores.profiles.ler(contaId)).restricoes
      await stores.profiles.definirRestricoes(contaId, [...new Set([...atuais, ...c.itens])])
      return
    }
    case "nao_come":
      await gravarNaoCome(stores, contaId, c.itens)
      return
    case "gosta":
      for (const i of c.itens) {
        await stores.preferences.definirGosto(
          contaId,
          { tipo: "alimento", id: i.alimento_id },
          "gosta",
        )
      }
      return
    case "rotina":
      await stores.routine.anotar(contaId, c.texto)
      return
  }
}

// Confirma um padrão que ainda é candidato da conta. Padrão de outra conta, decidido ou inexistente: não aceita.
async function confirmarPadrao(
  stores: Stores,
  contaId: string,
  padraoId: string,
): Promise<boolean> {
  const candidatos = await stores.patterns.listar(contaId, "candidato")
  if (!candidatos.some((p) => p.id === padraoId)) return false
  await stores.patterns.decidir(contaId, padraoId, "confirmado")
  return true
}

async function gravar(stores: Stores, contaId: string, c: ConteudoDaProposta): Promise<boolean> {
  switch (c.tool) {
    case "casa.propor":
      if (c.acao === "tem")
        await stores.pantry.registrar(contaId, c.itens.map(referencia), "conversa")
      else await stores.pantry.marcarAcabou(contaId, c.itens.map(referencia))
      return true
    case "memoria.propor":
      await gravarMemoria(stores, contaId, c)
      return true
    case "lista.propor":
      await stores.shortages.porNaLista(contaId, {
        alimento_id: c.alimento_id,
        motivo: c.motivo,
        detalhe: c.detalhe,
      })
      return true
    case "padrao.confirmar":
      return confirmarPadrao(stores, contaId, c.padrao_id)
  }
}

// Com o teto de notas ativas cheio, uma rotina nova não entra.
async function rotinaCheia(stores: Stores, contaId: string): Promise<boolean> {
  const ativas = await stores.routine.notasAtivas(contaId)
  return ativas.length >= config.memoria.rotinaNotasAtivas
}

/** Grava uma proposta aprovada; só acrescenta. `false`: não aceita, nada gravado. */
export async function executarProposta(
  stores: Stores,
  contaId: string,
  tool: string,
  conteudo: unknown,
  kb: KnowledgeBase,
): Promise<boolean> {
  const c = lerConteudo(tool, conteudo)
  if (!c || foraDaBase(c, kb)) return false
  if (c.tool === "memoria.propor" && c.tipo === "rotina" && (await rotinaCheia(stores, contaId)))
    return false
  return gravar(stores, contaId, c)
}
