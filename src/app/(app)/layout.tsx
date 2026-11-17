import { config } from "@config/index"
import type { ReactNode } from "react"
import { Logo } from "@/components/brand/logo"
import { AbasPrincipais } from "@/components/ritu/abas"
import { DemoBanner } from "@/components/ritu/demo-banner"
import { googleDisponivel } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"
import { entrarComGoogleAcao, sair } from "../_acoes/sessao"
import { exigirPasso } from "../_lib/conta"
import { MenuDaConta } from "./menu-da-conta"

export default async function MolduraDeQuemEntrou({ children }: { children: ReactNode }) {
  const { conta } = await exigirPasso("pronto")
  const abas = config.textosConversa.abas
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-shell items-center justify-between px-6 py-2">
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
      <div className="mx-auto flex max-w-shell flex-col px-6 lg:flex-row lg:gap-8">
        <AbasPrincipais
          rotulo={abas.rotulo}
          conversa={abas.conversa}
          casa={abas.casa}
          comoFicou={abas.comoFicou}
          voce={abas.voce}
        />
        <main id="conteudo" className="min-w-0 max-w-content flex-1 py-8 pb-28 lg:pb-8">
          {children}
        </main>
      </div>
    </>
  )
}
