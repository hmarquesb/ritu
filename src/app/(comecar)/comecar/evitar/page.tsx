import { config } from "@config/index"
import { exigirPasso } from "@/app/_lib/conta"
import { getContainer } from "@/infra/container"
import { EscolherEvitar } from "./escolher-evitar"

export const dynamic = "force-dynamic"

const { evitar } = config.textosEntrada

export default async function EvitarPage() {
  await exigirPasso("evitar")
  const grupos = getContainer().knowledge.gruposEvitar.map(({ id, nome }) => ({ id, nome }))
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="font-title text-title text-ink">{evitar.titulo}</h1>
        <p className="text-prose text-ink-muted">{evitar.apoio}</p>
      </div>
      <EscolherEvitar
        grupos={grupos}
        botoes={evitar.botoes}
        maxItens={config.limites.evitar.maxItens}
        maxTexto={config.limites.evitar.textoLivreCaracteres}
        minBusca={config.limites.buscaDeAlimento.minimoCaracteres}
      />
    </>
  )
}
