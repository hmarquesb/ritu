import { config } from "@config/index"
import { exigirPasso } from "@/app/_lib/conta"
import { getContainer } from "@/infra/container"
import { EscolherDosha } from "./escolher-dosha"

export const dynamic = "force-dynamic"

const { dosha, cidade } = config.textosEntrada

export default async function DoshaPage() {
  await exigirPasso("dosha")
  const doshas = getContainer().knowledge.doshas.map(({ id, nome }) => ({ id, nome }))
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="font-title text-title text-ink">{dosha.titulo}</h1>
        <p className="text-prose text-ink-muted">{dosha.apoio}</p>
      </div>
      <EscolherDosha
        opcoes={dosha.opcoes}
        doshas={doshas}
        cidade={{ titulo: cidade.titulo, apoio: cidade.apoio }}
      />
    </>
  )
}
