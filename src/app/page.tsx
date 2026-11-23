import { config } from "@config/index"
import Image from "next/image"
import { redirect } from "next/navigation"
import { entrarComGoogleAcao, entrarNaDemonstracao } from "@/app/_acoes/sessao"
import { BotaoDeEnvio } from "@/app/_entrada/cartao-de-entrada"
import { contaAtual } from "@/app/_lib/conta"
import { Surface } from "@/components/base/surface"
import { Logo } from "@/components/brand/logo"
import { ConviteParaRolar } from "@/components/ritu/landing/convite"
import { LandingSecoes } from "@/components/ritu/landing/secoes"
import { RodapePublico } from "@/components/ritu/publico/rodape"
import { estadoDaEntrada } from "@/core/accounts/entrada"
import { proximoPasso, ROTA_DO_PASSO } from "@/core/accounts/onboarding"
import { diaLocal } from "@/core/time/dia-local"
import { googleDisponivel } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"

type Busca = Record<string, string | string[] | undefined>

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

const textos = config.textosEntrada

export default async function Entrada(props: { searchParams: Promise<Busca> }) {
  const atual = await contaAtual()
  if (atual) redirect(ROTA_DO_PASSO[proximoPasso(atual.conta, atual.perfil)])

  const busca = await props.searchParams
  const { limiter, clock } = getContainer()
  const demosHoje = await limiter.usado("demo:global", "dia", diaLocal(clock.now()))
  const aviso = primeiro(busca.aviso)
  const estado = estadoDaEntrada({
    google: googleDisponivel(),
    demosHoje,
    tetoGlobal: config.limites.demo.globalPorDia,
    aviso,
    erro: primeiro(busca.error),
  })
  const textoDoAviso =
    aviso === "erro_demo"
      ? "Não consegui abrir a demonstração agora. Tente de novo."
      : estado.aviso
        ? textos.aviso[estado.aviso]
        : undefined

  return (
    <>
      <main id="conteudo" className="bg-canvas">
        <div className="relative flex min-h-dvh flex-col min-[64rem]:block">
          <div
            aria-hidden="true"
            className="relative h-[42dvh] w-full shrink-0 [clip-path:polygon(0_0,100%_0,100%_58%,0_100%)] min-[64rem]:absolute min-[64rem]:inset-y-0 min-[64rem]:left-0 min-[64rem]:h-auto min-[64rem]:w-[63%] min-[64rem]:[clip-path:polygon(0_0,43%_0,100%_100%,0_100%)]"
          >
            <Image
              src="/marca/entrada.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 64rem) 63vw, 100vw"
              className="object-cover [object-position:30%_60%]"
            />
          </div>

          <div className="absolute right-5 top-[calc(42dvh-3.5rem)] text-ink min-[64rem]:hidden">
            <Logo variant="full" size="md" />
          </div>
          <div className="absolute inset-x-0 top-[6dvh] hidden justify-center text-ink min-[64rem]:flex">
            <Logo variant="full" size="lg" />
          </div>

          <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 min-[64rem]:absolute min-[64rem]:inset-y-0 min-[64rem]:right-0 min-[64rem]:w-[37%] min-[64rem]:items-center min-[64rem]:px-6 min-[64rem]:py-8">
            <Surface
              tone="raised"
              radius="lg"
              shadow="lift"
              padding="lg"
              className="flex w-full max-w-[26rem] flex-col gap-5"
            >
              <header className="flex flex-col gap-1">
                <h1 className="font-title text-title text-ink">{textos.entrada.titulo}</h1>
                <p className="font-title text-title-sm text-ink-muted">
                  {textos.entrada.subtitulo}
                </p>
              </header>
              <p className="text-body text-ink">{textos.entrada.oQueE}</p>

              {textoDoAviso ? (
                <p role="status" className="rounded-md bg-amber-soft p-3 text-sm text-amber-ink">
                  {textoDoAviso}
                </p>
              ) : null}

              {estado.demo ? (
                <form action={entrarNaDemonstracao} className="flex flex-col gap-2">
                  <BotaoDeEnvio variante="primary">{textos.entrada.demo}</BotaoDeEnvio>
                  <p className="text-sm text-ink-muted">{textos.entrada.demoApoio}</p>
                </form>
              ) : null}

              {estado.google ? (
                <form action={entrarComGoogleAcao} className="flex flex-col gap-2">
                  <BotaoDeEnvio variante="secondary">{textos.entrada.google}</BotaoDeEnvio>
                  <p className="text-sm text-ink-muted">{textos.entrada.googleApoio}</p>
                </form>
              ) : null}

              <p className="text-sm text-ink-muted">{textos.entrada.aviso}</p>
            </Surface>
          </div>

          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center min-[64rem]:left-auto min-[64rem]:right-0 min-[64rem]:w-[37%]">
            <ConviteParaRolar className="inline-flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium text-ink underline underline-offset-4" />
          </div>
        </div>
        <LandingSecoes
          estado={estado}
          kb={getContainer().knowledge}
          acaoDemo={entrarNaDemonstracao}
          acaoGoogle={entrarComGoogleAcao}
        />
      </main>
      <RodapePublico />
    </>
  )
}
