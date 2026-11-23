import { config, textosLanding } from "@config/index"
import { Surface } from "@/components/base/surface"
import { DoshaBlot } from "@/components/brand/dosha-blot"
import type { estadoDaEntrada } from "@/core/accounts/entrada"
import { BotaoDeEnvioDaLanding } from "./envio"

const T = textosLanding.final
const E = config.textosEntrada

type Acao = (formData: FormData) => void | Promise<void>

export type ChamadaFinalProps = {
  estado: ReturnType<typeof estadoDaEntrada>
  // As mesmas ações de servidor do cartão da Entrada (017).
  acaoDemo: Acao
  acaoGoogle: Acao
}

export function ChamadaFinal({ estado, acaoDemo, acaoGoogle }: ChamadaFinalProps) {
  const semAcao = !estado.demo && !estado.google
  return (
    <section aria-labelledby="chamada-final">
      <Surface
        tone="paper"
        radius="card"
        padding="lg"
        className="relative flex flex-col items-start gap-4 overflow-hidden"
      >
        <div aria-hidden="true" className="flex [&>span+span]:-ml-4">
          <DoshaBlot dosha="vata" size="sm" withIcon={false} />
          <DoshaBlot dosha="pitta" size="sm" withIcon={false} />
          <DoshaBlot dosha="kapha" size="sm" withIcon={false} />
        </div>
        <h2 id="chamada-final" className="font-title text-title text-paper-ink">
          {T.titulo}
        </h2>
        <p className="max-w-prose text-body text-paper-ink">{T.texto}</p>
        {estado.demo ? (
          <form action={acaoDemo}>
            <BotaoDeEnvioDaLanding variante="primary">{E.entrada.demo}</BotaoDeEnvioDaLanding>
          </form>
        ) : null}
        {estado.google ? (
          <form action={acaoGoogle}>
            <BotaoDeEnvioDaLanding variante="secondary">{E.entrada.google}</BotaoDeEnvioDaLanding>
          </form>
        ) : null}
        {semAcao && estado.aviso ? (
          <p className="text-body text-paper-ink">{E.aviso[estado.aviso]}</p>
        ) : null}
      </Surface>
    </section>
  )
}
