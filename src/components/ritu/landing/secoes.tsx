import type { estadoDaEntrada } from "@/core/accounts/entrada"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { ChamadaFinal, type ChamadaFinalProps } from "./chamada-final"
import { ComoFunciona } from "./como-funciona"
import { ConversaDeExemplo } from "./exemplo"
import { FazENaoFaz } from "./faz-nao-faz"
import { PorDentro } from "./por-dentro"
import { Revelar } from "./revelar"

export type LandingSecoesProps = {
  estado: ReturnType<typeof estadoDaEntrada>
  kb: KnowledgeBase
  acaoDemo: ChamadaFinalProps["acaoDemo"]
  acaoGoogle: ChamadaFinalProps["acaoGoogle"]
}

export function LandingSecoes({ estado, kb, acaoDemo, acaoGoogle }: LandingSecoesProps) {
  return (
    <div id="conheca" className="mx-auto w-full max-w-[64rem] px-4 pb-12 min-[48rem]:px-6">
      <div
        aria-hidden="true"
        className="relative my-8 flex items-center justify-center border-t border-line"
      >
        <img
          src="/marca/mancha-vata.webp"
          alt=""
          className="absolute -top-4 size-8 bg-canvas object-contain"
        />
      </div>
      <div className="flex flex-col gap-8 min-[48rem]:gap-12">
        <Revelar>
          <ComoFunciona />
        </Revelar>
        <Revelar>
          <ConversaDeExemplo kb={kb} />
        </Revelar>
        <Revelar>
          <FazENaoFaz />
        </Revelar>
        <Revelar>
          <PorDentro />
        </Revelar>
        <Revelar>
          <ChamadaFinal estado={estado} acaoDemo={acaoDemo} acaoGoogle={acaoGoogle} />
        </Revelar>
      </div>
    </div>
  )
}
