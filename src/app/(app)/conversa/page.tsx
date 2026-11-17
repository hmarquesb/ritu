import { config } from "@config/index"
import { headers } from "next/headers"
import { StateBlock } from "@/components/base/state-block"
import { Conversa } from "@/components/ritu/conversa/conversa"
import { conversaDoDia } from "@/core/conversation/do-dia"
import { textoDaMensagem } from "@/core/messages/texto"
import { googleDisponivel, quemPedeDosHeaders } from "@/infra/auth/next"
import { getContainer } from "@/infra/container"
import { entrarComGoogleAcao } from "../../_acoes/sessao"
import { exigirPasso } from "../../_lib/conta"

const T = config.textosConversa

export default async function PaginaDaConversa() {
  const { conta, perfil } = await exigirPasso("pronto")
  const { stores, clock, demoSeed, knowledge, limiter, router, telemetry } = getContainer()
  const { ipHash, escopo, teto } = quemPedeDosHeaders(await headers())
  const inicial = await conversaDoDia(
    { stores, clock, seed: demoSeed, limiter, router, telemetry },
    conta,
    perfil,
    { ipHash, ...(escopo ? { escopo } : {}), ...(teto !== undefined ? { teto } : {}) },
  )
  const atalhos = knowledge.estados.map((e) => ({ id: e.id, rotulo: e.rotulo }))
  // A mesma função que o servidor usa ao gravar a fala: a fala otimista não muda ao recarregar.
  const rotulos = Object.fromEntries(
    knowledge.estados.map((e) => [e.id, textoDaMensagem({ atalhos: [e.id] }, knowledge)]),
  )
  return (
    <>
      <h1 className="sr-only">{T.abas.conversa}</h1>
      <noscript>
        <p className="font-body text-body text-ink">{T.semJs}</p>
      </noscript>
      <Conversa
        inicial={inicial}
        atalhos={atalhos}
        rotulos={rotulos}
        googleDisponivel={googleDisponivel()}
        entrarComGoogleAcao={entrarComGoogleAcao}
        vazio={<StateBlock kind="empty" title={T.vazia.titulo} description={T.vazia.texto} />}
      />
    </>
  )
}
