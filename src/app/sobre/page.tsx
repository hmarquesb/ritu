import { publico, textosSobre } from "@config/index"
import { TextLink } from "@/components/base/text-link"
import { CabecalhoPublico } from "@/components/ritu/publico/cabecalho"
import { RodapePublico } from "@/components/ritu/publico/rodape"
import { IndiceDoSobre } from "@/components/ritu/sobre/indice"
import { Politica } from "@/components/ritu/sobre/politica"
import { Paragrafos, SecaoDoSobre } from "@/components/ritu/sobre/secao"
import { prazosDaPolitica, preencher } from "@/core/publico/prazos"
import { contatoDaImplantacao } from "../_lib/contato"

export const dynamic = "force-dynamic"

export const metadata = { title: "Sobre" }

const T = textosSobre
const NOVA_ABA = { target: "_blank", rel: "noopener" } as const

const ITENS = [
  { id: "projeto", titulo: T.projeto.titulo },
  { id: "autoria", titulo: T.autoria.titulo },
  { id: "feito", titulo: T.feito.titulo },
  { id: "fontes", titulo: T.fontes.titulo },
  { id: "cuidados", titulo: T.cuidados.titulo },
  { id: "privacidade", titulo: T.privacidade.titulo },
] as const

const REPO = publico.repositorio

function Links({ itens }: { itens: { rotulo: string; href: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {itens.map((item) => (
        <li key={item.href}>
          <TextLink href={item.href} className="inline-flex min-h-11 items-center" {...NOVA_ABA}>
            {item.rotulo}
          </TextLink>
        </li>
      ))}
    </ul>
  )
}

export default function Sobre() {
  const [codigo, adrs, bastidores] = T.feito.links
  const [basesFontes, openMeteo] = T.fontes.links
  return (
    <>
      <CabecalhoPublico />
      <main
        id="conteudo"
        className="mx-auto grid w-full max-w-[64rem] gap-x-12 gap-y-8 px-4 pb-12 pt-6 min-[48rem]:px-6 min-[64rem]:grid-cols-[14rem_minmax(0,1fr)]"
      >
        <h1 className="font-title text-display font-medium text-ink min-[64rem]:col-span-2">
          {T.titulo}
        </h1>
        <IndiceDoSobre itens={ITENS} />
        <div className="flex min-w-0 flex-col gap-10">
          <SecaoDoSobre id="projeto" titulo={T.projeto.titulo}>
            <Paragrafos texto={T.projeto.texto} />
          </SecaoDoSobre>
          <SecaoDoSobre id="autoria" titulo={T.autoria.titulo}>
            <p className="max-w-prose text-prose text-ink">
              {T.autoria.texto.replace("{nome}", publico.autoria.nome)}
            </p>
            <Links
              itens={[
                { rotulo: T.autoria.github, href: publico.autoria.github },
                { rotulo: T.autoria.linkedin, href: publico.autoria.linkedin },
              ]}
            />
          </SecaoDoSobre>
          <SecaoDoSobre id="feito" titulo={T.feito.titulo}>
            <Paragrafos texto={T.feito.texto} />
            <p className="max-w-prose text-prose text-ink">{T.feito.licenca}</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              <li>
                <TextLink href={REPO} className="inline-flex min-h-11 items-center" {...NOVA_ABA}>
                  {codigo}
                </TextLink>
              </li>
              <li>
                <TextLink
                  href={`${REPO}/tree/main/.adrs`}
                  className="inline-flex min-h-11 items-center"
                  {...NOVA_ABA}
                >
                  {adrs}
                </TextLink>
              </li>
              <li>
                <TextLink href="/bastidores" className="inline-flex min-h-11 items-center">
                  {bastidores}
                </TextLink>
              </li>
            </ul>
          </SecaoDoSobre>
          <SecaoDoSobre id="fontes" titulo={T.fontes.titulo}>
            <Paragrafos texto={T.fontes.texto} />
            <Links
              itens={[
                { rotulo: basesFontes, href: `${REPO}/blob/main/data/fontes.yaml` },
                { rotulo: openMeteo, href: "https://open-meteo.com/" },
              ]}
            />
          </SecaoDoSobre>
          <SecaoDoSobre id="cuidados" titulo={T.cuidados.titulo}>
            <Paragrafos texto={T.cuidados.texto} />
            <Paragrafos texto={T.cuidados.alerta} />
            <Paragrafos texto={T.cuidados.emocional} />
          </SecaoDoSobre>
          <SecaoDoSobre id="privacidade" titulo={T.privacidade.titulo}>
            <Politica
              contato={contatoDaImplantacao()}
              prazos={prazosDaPolitica()}
              preencher={preencher}
            />
          </SecaoDoSobre>
        </div>
      </main>
      <RodapePublico atual="sobre" />
    </>
  )
}
