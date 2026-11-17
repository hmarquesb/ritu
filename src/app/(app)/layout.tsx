import { config } from "@config/index"
import type { ReactNode } from "react"
import { Logo } from "@/components/brand/logo"
import { DemoBanner } from "@/components/ritu/demo-banner"
import { googleDisponivel } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"
import { entrarComGoogleAcao, sair } from "../_acoes/sessao"
import { exigirPasso } from "../_lib/conta"
import { MenuDaConta } from "./menu-da-conta"

export default async function MolduraDeQuemEntrou({ children }: { children: ReactNode }) {
  const { conta } = await exigirPasso("pronto")
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-content items-center justify-between px-6 py-2">
          <Logo variant="full" size="sm" />
          <MenuDaConta sair={sair} />
        </div>
      </header>
      {conta.tipo === "demo" ? (
        <DemoBanner
          texto={getContainer().demoSeed.faixa}
          podeCriarPerfil={googleDisponivel()}
          entrarComGoogleAcao={entrarComGoogleAcao}
          textoDoBotao={config.textosEntrada.faixa.botao}
        />
      ) : null}
      <main id="conteudo" className="mx-auto max-w-content px-6 py-8">
        {children}
      </main>
    </>
  )
}
