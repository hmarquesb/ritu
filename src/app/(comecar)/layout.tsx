import type { ReactNode } from "react"
import { Logo } from "@/components/brand/logo"

export default function ComecarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-6 pb-12 pt-8">
      <div className="flex w-full max-w-content flex-col gap-8">
        <header>
          <Logo variant="full" size="sm" className="text-ink" />
        </header>
        <noscript>
          <p className="rounded-md bg-danger-soft px-4 py-3 text-body text-danger">
            Esta tela precisa de JavaScript para funcionar. Ative o JavaScript no navegador e
            recarregue a página.
          </p>
        </noscript>
        <main id="conteudo" className="flex flex-col gap-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
