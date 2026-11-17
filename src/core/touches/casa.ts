import { z } from "zod"
import { RituError } from "@/core/errors"
import { identificarAlimento } from "@/core/knowledge/identificar"
import { estadoDoItem } from "@/core/pantry/estado"
import type { ReferenciaDeItem } from "@/core/pantry/ports"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { Stores } from "@/core/stores"
import type { Deps } from "./deps"

export const acaoDaCasaSchema = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("adicionar"), alimento_id: z.string().min(1).max(60) }),
  z.strictObject({ acao: z.literal("adicionar_texto"), texto: z.string().trim().min(2).max(40) }),
  z.strictObject({ acao: z.literal("tenho"), item_id: z.uuid() }),
  z.strictObject({ acao: z.literal("acabou"), item_id: z.uuid() }),
  z.strictObject({ acao: z.literal("sempre_tenho"), item_id: z.uuid(), valor: z.boolean() }),
  z.strictObject({ acao: z.literal("tirar"), item_id: z.uuid() }),
])

export type AcaoDaCasa = z.infer<typeof acaoDaCasaSchema>

const toqueInvalido = () => new RituError("toque_invalido", "Toque inválido")

function nomeDaBase(deps: Deps, alimentoId: string): string | undefined {
  return deps.kb.alimento(alimentoId)?.nome
}

function nomeDoItem(deps: Deps, item: ItemDaCasa): string {
  if (item.alimento_id) return nomeDaBase(deps, item.alimento_id) ?? item.alimento_id
  return item.nome_livre ?? ""
}

function referenciaDo(item: ItemDaCasa): ReferenciaDeItem {
  if (item.alimento_id) return { alimento_id: item.alimento_id }
  return { nome_livre: item.nome_livre ?? "" }
}

async function acharDaConta(stores: Stores, contaId: string, itemId: string): Promise<ItemDaCasa> {
  const item = (await stores.pantry.listar(contaId)).find((i) => i.id === itemId)
  if (!item) throw toqueInvalido()
  return item
}

async function adicionarAlimento(
  deps: Deps,
  stores: Stores,
  contaId: string,
  alimentoId: string,
): Promise<{ nome: string }> {
  const nome = nomeDaBase(deps, alimentoId)
  if (!nome) throw toqueInvalido()
  await stores.pantry.registrar(contaId, [{ alimento_id: alimentoId }], "tela")
  return { nome }
}

async function adicionarTexto(
  deps: Deps,
  stores: Stores,
  contaId: string,
  texto: string,
): Promise<{ nome: string }> {
  const identificado = identificarAlimento(texto, deps.kb)
  if (identificado.tipo === "alimento")
    return adicionarAlimento(deps, stores, contaId, identificado.id)
  await stores.pantry.registrar(contaId, [{ nome_livre: texto }], "tela")
  return { nome: texto }
}

async function sempreTenho(
  deps: Deps,
  stores: Stores,
  contaId: string,
  itemId: string,
  valor: boolean,
): Promise<{ nome: string }> {
  const item = await acharDaConta(stores, contaId, itemId)
  const durabilidade = item.alimento_id
    ? deps.kb.alimento(item.alimento_id)?.durabilidade
    : undefined
  if (valor && estadoDoItem(item, deps.clock.now(), durabilidade) === "acabou") {
    throw toqueInvalido()
  }
  await stores.pantry.definirSempreTenho(contaId, itemId, valor)
  return { nome: nomeDoItem(deps, item) }
}

async function executar(
  deps: Deps,
  stores: Stores,
  contaId: string,
  acao: AcaoDaCasa,
): Promise<{ nome: string }> {
  switch (acao.acao) {
    case "adicionar":
      return adicionarAlimento(deps, stores, contaId, acao.alimento_id)
    case "adicionar_texto":
      return adicionarTexto(deps, stores, contaId, acao.texto)
    case "sempre_tenho":
      return sempreTenho(deps, stores, contaId, acao.item_id, acao.valor)
    case "tenho": {
      const item = await acharDaConta(stores, contaId, acao.item_id)
      await stores.pantry.registrar(contaId, [referenciaDo(item)], "tela")
      return { nome: nomeDoItem(deps, item) }
    }
    case "acabou": {
      const item = await acharDaConta(stores, contaId, acao.item_id)
      await stores.pantry.marcarAcabou(contaId, [referenciaDo(item)])
      return { nome: nomeDoItem(deps, item) }
    }
    case "tirar": {
      const item = await acharDaConta(stores, contaId, acao.item_id)
      await stores.pantry.tirar(contaId, item.id)
      return { nome: nomeDoItem(deps, item) }
    }
  }
}

export function tocarCasa(
  deps: Deps,
  contaId: string,
  acao: AcaoDaCasa,
): Promise<{ nome: string }> {
  return deps.telemetry.span("toque", { tipo: "casa" }, () =>
    deps.tx.emTransacao((stores) => executar(deps, stores, contaId, acao)),
  )
}
