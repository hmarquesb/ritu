"use client"

import { config } from "@config/index"
import { Heart, HeartBreak, PushPin } from "@phosphor-icons/react"
import { Chip } from "@/components/base/chip"
import { ICON } from "@/components/base/icon-size"
import type { ItemNaCasa } from "@/core/pantry/visao"

const T = config.textosCasa.rotulo

// "Canela, sempre tenho, você gosta": os ícones dizem o mesmo em palavras.
export function nomeAcessivel(item: ItemNaCasa): string {
  const partes = [item.nome]
  if (item.sempre_tenho) partes.push(T.sempre)
  if (item.gosto === "gosta") partes.push(T.gosta)
  if (item.gosto === "nao_gosta") partes.push(T.naoGosta)
  return partes.join(", ")
}

export function ItemDaCasa({ item, onAbrir }: { item: ItemNaCasa; onAbrir: (id: string) => void }) {
  return (
    <Chip
      aria-label={nomeAcessivel(item)}
      onPress={() => onAbrir(item.id)}
      className="animate-[fade_var(--ritu-fast)_var(--ease-ritu)_both]"
    >
      <span>{item.nome}</span>
      {item.sempre_tenho ? (
        <PushPin weight="light" size={ICON.sm} aria-hidden="true" className="text-ink-muted" />
      ) : null}
      {item.gosto === "gosta" ? (
        <Heart weight="light" size={ICON.sm} aria-hidden="true" className="text-ink-muted" />
      ) : null}
      {item.gosto === "nao_gosta" ? (
        <HeartBreak weight="light" size={ICON.sm} aria-hidden="true" className="text-ink-muted" />
      ) : null}
    </Chip>
  )
}
