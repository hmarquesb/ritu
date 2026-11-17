"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "@/components/base/button"
import { StateBlock } from "@/components/base/state-block"
import type { ConversaDoDia, FalaNaTela } from "@/core/conversation/do-dia"
import type { FraseDeEtapa } from "@/core/conversation/etapas"
import type { VisaoDoRun } from "@/core/conversation/visao"
import type { ResultadoDaTroca } from "@/core/touches/troca"
import { BlocoDeAprovacao } from "./bloco-aprovacao"
import { type Atalho, CaixaDeMensagem } from "./caixa"
import { EtapasAoVivo, EtapasRecolhidas } from "./etapas"
import { FaixaDeCota } from "./faixa-cota"
import { FalaDaPessoa, FalaDoAgente } from "./fala"
import { LinhaParaTer } from "./para-ter"
import { PerguntaDoAgente } from "./pergunta"
import { IndicadorDeRetornos } from "./retornos"
import { RodapeDaResposta } from "./rodape"
import { BlocoDeSugestao } from "./sugestao"
import { useConversa } from "./use-conversa"

const T = config.textosConversa
const T_LIMITES = config.textosLimites

export type ConversaProps = {
  inicial: ConversaDoDia
  atalhos: Atalho[]
  rotulos?: Record<string, string>
  vazio?: ReactNode
  googleDisponivel?: boolean
  entrarComGoogleAcao?: () => Promise<void>
}

type Troca = { alimento_id: string; resultado: ResultadoDaTroca }
type Conversa = ReturnType<typeof useConversa>

const ERROS_COM_RETENTATIVA = new Set(["rede", "inesperado"])

function textoDoErro(codigo: string): string {
  const erros: Record<string, string> = T.erro
  return erros[codigo] ?? T.erro.inesperado
}

function ehResultadoDaTroca(v: unknown): v is ResultadoDaTroca {
  return typeof v === "object" && v !== null && "resultado" in v
}

function EtapasDoRun({ frases }: { frases: FraseDeEtapa[] }) {
  const lista = frases.length > 0 ? frases : [{ chave: "ainda", texto: T.etapas.entendendo }]
  return <EtapasAoVivo frases={lista} />
}

type ExtrasProps = {
  visao: VisaoDoRun
  trocas: Record<string, Troca>
  conversa: Conversa
  aoTrocou: (runId: string, posicao: number, troca: Troca) => void
}

// O que vem depois da fala do agente: avisos, sugestões, evitar, para ter, pergunta, bloco, etapas e rodapé.
function ExtrasDoRun({ visao, trocas, conversa, aoTrocou }: ExtrasProps) {
  const { responder, aprovar, trocar, responderTroca, votar } = conversa
  const runId = visao.run_id
  return (
    <>
      {visao.avisos.map((aviso) => (
        <p key={aviso.texto} className="max-w-prose font-body text-sm text-ink-muted">
          {aviso.texto}
        </p>
      ))}
      {visao.sugestoes.map((sugestao) => {
        const chave = `${runId}:${sugestao.posicao}`
        const guardar = (alimento: string) => (lido: Record<string, unknown> | undefined) => {
          if (lido && ehResultadoDaTroca(lido.resultado)) {
            aoTrocou(runId, sugestao.posicao, { alimento_id: alimento, resultado: lido.resultado })
          }
        }
        return (
          <BlocoDeSugestao
            key={chave}
            sugestao={sugestao}
            resultadoDaTroca={trocas[chave]}
            aoTrocar={(alimento, motivo) =>
              void trocar(runId, {
                sugestao: sugestao.posicao,
                alimento_id: alimento,
                motivo,
              }).then(guardar(alimento))
            }
            aoResponderTroca={(alimento, candidato, resposta) =>
              void responderTroca(runId, {
                sugestao: sugestao.posicao,
                alimento_id: alimento,
                candidato,
                resposta,
              }).then(guardar(alimento))
            }
          />
        )
      })}
      {visao.evitar.length > 0 ? (
        <p className="max-w-prose font-body text-body text-ink">
          {formatar(T.evitar.rotulo, { itens: visao.evitar.join(", ") })}
        </p>
      ) : null}
      {visao.para_ter ? <LinhaParaTer paraTer={visao.para_ter} /> : null}
      {visao.pergunta && visao.pergunta.estado !== "respondida" ? (
        <PerguntaDoAgente
          key={`${runId}:${visao.pergunta.estado}`}
          pergunta={visao.pergunta}
          aoResponder={(resposta) => void responder(runId, resposta)}
        />
      ) : null}
      {visao.bloco ? (
        <BlocoDeAprovacao
          key={`${runId}:${visao.bloco.estado}`}
          bloco={visao.bloco}
          aoAprovar={(ids) => void aprovar(runId, ids)}
        />
      ) : null}
      <EtapasRecolhidas passos={visao.frases.length} runId={runId} />
      {visao.resposta !== undefined ? (
        <RodapeDaResposta
          voto={visao.voto}
          podeVotar={visao.podeVotar}
          aoVotar={(voto) => void votar(runId, voto)}
        />
      ) : null}
    </>
  )
}

// Cada run mostra os extras depois da fala do agente; sem fala do agente, depois da fala da pessoa.
function ondeFicamOsExtras(falas: FalaNaTela[]): Map<string, string> {
  const onde = new Map<string, string>()
  for (const f of falas) {
    if (f.run_id && (f.autor === "agente" || !onde.has(f.run_id))) onde.set(f.run_id, f.id)
  }
  return onde
}

export function Conversa({
  inicial,
  atalhos,
  rotulos = {},
  vazio,
  googleDisponivel = false,
  entrarComGoogleAcao,
}: ConversaProps) {
  const conversa = useConversa(inicial, rotulos)
  const { limites, textoGuardado, estado, tentarDeNovo, enviar, digitar, marcar } = conversa
  const [trocas, setTrocas] = useState<Record<string, Troca>>({})
  const listaRef = useRef<HTMLDivElement>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  // Mede o painel fixo e guarda a altura numa variável CSS: a rolagem até a resposta a leva em conta.
  useEffect(() => {
    const painel = painelRef.current
    const raiz = raizRef.current
    if (!painel || !raiz) return
    const medir = () => raiz.style.setProperty("--painel-h", `${painel.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(painel)
    return () => observador.disconnect()
  }, [])

  const cotaEsgotada = limites.cota_ia.esgotada
  const voltaAs = limites.cota_ia.esgotada ? limites.cota_ia.volta_as : ""
  const cotaAntes = useRef(cotaEsgotada)
  const [anuncioDaCota, setAnuncioDaCota] = useState("")

  // A faixa que aparece depois do carregamento é anunciada uma vez; a que já veio na página, não.
  useEffect(() => {
    if (cotaEsgotada && !cotaAntes.current) {
      setAnuncioDaCota(T_LIMITES.cota.faixa.replace("{hora}", voltaAs))
    }
    if (!cotaEsgotada) setAnuncioDaCota("")
    cotaAntes.current = cotaEsgotada
  }, [cotaEsgotada, voltaAs])

  const statusAberto = estado.aberto?.status
  const statusAnterior = useRef(statusAberto)

  useEffect(() => {
    const virouPausa =
      statusAnterior.current !== statusAberto &&
      (statusAberto === "waiting_for_input" || statusAberto === "waiting_for_approval")
    statusAnterior.current = statusAberto
    if (!estado.anuncio && !virouPausa) return
    const respostas = listaRef.current?.querySelectorAll("[data-fala-agente]")
    const ultima = respostas?.item(respostas.length - 1)
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const behavior = reduzido ? "auto" : "smooth"
    // Com fala do agente, ela vai para o alto; sem fala (só pergunta ou bloco), o fim da lista
    // fica logo acima do painel, que não cobre nada da conversa.
    if (ultima && !virouPausa) ultima.scrollIntoView({ block: "start", behavior })
    else listaRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior })
  }, [estado.anuncio, statusAberto])

  const onde = ondeFicamOsExtras(estado.falas)
  const mostrados = new Set(onde.values())
  const soltos = Object.values(estado.runs).filter((v) => !onde.has(v.run_id) && v.run_id)
  const trabalhando = estado.aoVivo !== undefined || estado.aberto?.status === "running"
  const frasesAoVivo =
    estado.aoVivo?.frases ??
    (estado.aberto ? (estado.runs[estado.aberto.run_id]?.frases ?? []) : [])
  const ultimaFrase = estado.aoVivo?.frases.at(-1)?.texto ?? ""
  const semNada = estado.falas.length === 0 && estado.aberto === undefined && !estado.aoVivo
  const aoTrocou = (runId: string, posicao: number, troca: Troca) =>
    setTrocas((t) => ({ ...t, [`${runId}:${posicao}`]: troca }))

  return (
    <div ref={raizRef} className="flex min-h-[60dvh] flex-col gap-4">
      {limites.cota_ia.esgotada ? <FaixaDeCota voltaAs={limites.cota_ia.volta_as} /> : null}
      <div
        ref={listaRef}
        role="log"
        aria-label={T.abas.conversa}
        className="flex flex-1 flex-col [&>*]:scroll-mb-[var(--painel-h,0px)] gap-5"
      >
        {semNada ? vazio : null}
        {estado.falas.map((fala) => {
          const visao = fala.run_id ? estado.runs[fala.run_id] : undefined
          return (
            <div key={fala.id} className="flex flex-col gap-5">
              {fala.autor === "pessoa" ? (
                <FalaDaPessoa texto={fala.texto} />
              ) : (
                <div data-fala-agente="" className="scroll-mt-4 scroll-mb-[var(--painel-h,0px)]">
                  <FalaDoAgente texto={fala.texto} />
                </div>
              )}
              {visao && mostrados.has(fala.id) && onde.get(visao.run_id) === fala.id ? (
                <ExtrasDoRun
                  visao={visao}
                  trocas={trocas}
                  conversa={conversa}
                  aoTrocou={aoTrocou}
                />
              ) : null}
            </div>
          )
        })}
        {soltos.map((visao) => (
          <ExtrasDoRun
            key={visao.run_id}
            visao={visao}
            trocas={trocas}
            conversa={conversa}
            aoTrocou={aoTrocou}
          />
        ))}
        {trabalhando ? <EtapasDoRun frases={frasesAoVivo} /> : null}
        {estado.erro ? (
          <StateBlock
            kind="error"
            title={textoDoErro(estado.erro.codigo)}
            action={
              ERROS_COM_RETENTATIVA.has(estado.erro.codigo) ? (
                <Button variant="secondary" onPress={() => void tentarDeNovo()}>
                  {T.erro.tentar}
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </div>
      <div className="sr-only" aria-live="polite">
        {estado.anuncio}
      </div>
      <div className="sr-only" aria-live="polite">
        {anuncioDaCota}
      </div>
      <div className="sr-only" aria-live="polite">
        {ultimaFrase}
      </div>
      <div
        ref={painelRef}
        className="sticky bottom-[calc(var(--ritu-bar-h)+1px+env(safe-area-inset-bottom))] z-10 flex flex-col gap-1 bg-canvas lg:bottom-0"
      >
        <IndicadorDeRetornos n={estado.pendentes} />
        <CaixaDeMensagem
          texto={estado.caixa.texto}
          atalhos={estado.caixa.atalhos}
          atalhosDisponiveis={atalhos}
          respondendo={estado.caixa.respondendo}
          aoMudar={(v) => {
            if (v.texto !== estado.caixa.texto) digitar(v.texto)
            else marcar(v.atalhos)
          }}
          aoEnviar={() => void enviar()}
          limites={limites}
          textoGuardado={textoGuardado}
          googleDisponivel={googleDisponivel}
          entrarComGoogleAcao={entrarComGoogleAcao}
        />
      </div>
    </div>
  )
}
