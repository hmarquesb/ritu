import { config } from "@config/index"
import { sair } from "@/app/_acoes/sessao"
import { exigirPasso } from "@/app/_lib/conta"
import { Button } from "@/components/base/button"
import { TextLink } from "@/components/base/text-link"
import { AceitarAviso } from "./aceitar"

export const dynamic = "force-dynamic"

const { avisoInicial } = config.textosEntrada
const FRASES = [avisoInicial.saude, avisoInicial.ia, avisoInicial.memoria]

export default async function AvisoPage() {
  const { conta } = await exigirPasso("aviso")
  return (
    <>
      <h1 className="font-title text-display text-ink">{avisoInicial.titulo}</h1>
      <div className="flex flex-col gap-4 text-prose text-ink">
        {FRASES.map((frase) => (
          <p key={frase.forte}>
            <strong className="font-semibold">{frase.forte}</strong> {frase.resto}
          </p>
        ))}
        {conta.tipo === "demo" ? <p className="text-ink-muted">{avisoInicial.demo}</p> : null}
        <p>
          <TextLink href="/sobre#privacidade">{avisoInicial.politica}</TextLink>
        </p>
      </div>
      <AceitarAviso rotulo={avisoInicial.botao} />
      <form action={sair}>
        <Button type="submit" variant="quiet" size="sm">
          Sair
        </Button>
      </form>
    </>
  )
}
