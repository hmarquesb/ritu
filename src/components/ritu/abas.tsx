"use client"

import type { Icon } from "@phosphor-icons/react"
import { ArrowsClockwise, ChatCircle, House, User } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

export interface AbaPrincipal {
  href: string
  rotulo: string
}

export interface AbasPrincipaisProps {
  rotulo: string
  conversa: string
  casa: string
  comoFicou: string
  voce: string
}

const ICONES: Record<string, Icon> = {
  "/conversa": ChatCircle,
  "/casa": House,
  "/como-ficou": ArrowsClockwise,
  "/voce": User,
}

export function AbasPrincipais({ rotulo, conversa, casa, comoFicou, voce }: AbasPrincipaisProps) {
  const pathname = usePathname()
  const itens: AbaPrincipal[] = [
    { href: "/conversa", rotulo: conversa },
    { href: "/casa", rotulo: casa },
    { href: "/como-ficou", rotulo: comoFicou },
    { href: "/voce", rotulo: voce },
  ]
  return (
    <nav
      aria-label={rotulo}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:inset-x-auto lg:bottom-auto lg:z-auto lg:w-56 lg:shrink-0 lg:self-start lg:border-t-0 lg:bg-transparent lg:py-6 lg:pb-6"
    >
      <ul className="m-0 grid list-none grid-cols-4 p-0 lg:grid-cols-1 lg:gap-1">
        {itens.map(({ href, rotulo: texto }) => {
          const Glyph = ICONES[href] as Icon
          const atual = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 px-1 text-caption font-medium transition-colors",
                  "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:border-t-0 lg:border-l-2 lg:px-3 lg:text-body",
                  atual
                    ? "border-primary text-primary"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Glyph size={ICON.md} weight="light" aria-hidden="true" />
                <span>{texto}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
