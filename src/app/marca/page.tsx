import type { Metadata } from "next"
import { cookies } from "next/headers"
import type { ReactElement } from "react"
import { parseTheme, THEME_COOKIE } from "@/components/theme/theme"
import { SecaoComponentes } from "./_secoes/componentes"
import { SecaoCores } from "./_secoes/cores"
import { SecaoEstados } from "./_secoes/estados"
import { SecaoIcones } from "./_secoes/icones"
import { SecaoMarca } from "./_secoes/marca"
import { SecaoMovimento } from "./_secoes/movimento"
import { SecaoSuperficies } from "./_secoes/superficies"
import { SecaoTema } from "./_secoes/tema"
import { SecaoTipografia } from "./_secoes/tipografia"

export const metadata: Metadata = { title: "Marca", robots: { index: false } }

export default async function MarcaPage(): Promise<ReactElement> {
  const initial = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <main id="conteudo" className="mx-auto flex max-w-content flex-col gap-16 px-6 py-12">
      <h1 className="font-title text-display font-semibold text-ink">Marca</h1>
      <SecaoCores />
      <SecaoTipografia />
      <SecaoSuperficies />
      <SecaoIcones />
      <SecaoComponentes />
      <SecaoEstados />
      <SecaoMarca />
      <SecaoMovimento />
      <SecaoTema initial={initial} />
    </main>
  )
}
