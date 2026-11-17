import { cookies } from "next/headers"
import { Voce } from "@/components/ritu/voce/voce"
import { parseTheme, THEME_COOKIE } from "@/components/theme/theme"
import { googleDisponivel } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"
import { apagarMeusDados, entrarComGoogleAcao, sair } from "../../_acoes/sessao"
import { exigirPasso } from "../../_lib/conta"

export default async function VocePagina() {
  const { conta } = await exigirPasso("pronto")
  const container = getContainer()
  const [inicial, jar] = await Promise.all([container.lerVoce(conta), cookies()])
  const grupos = container.knowledge.gruposEvitar.map(({ id, nome }) => ({ id, nome }))
  return (
    <Voce
      inicial={inicial}
      grupos={grupos}
      tema={parseTheme(jar.get(THEME_COOKIE)?.value)}
      googleDisponivel={googleDisponivel()}
      criarPerfil={entrarComGoogleAcao}
      sair={sair}
      apagar={apagarMeusDados}
    />
  )
}
