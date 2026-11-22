import { config } from "@config/index"
import { mensagemRecebidaSchema } from "@/core/conversation/conversar"
import { visaoDoRunDaConta } from "@/core/conversation/do-dia"
import { type FraseDeEtapa, fraseDaEtapa } from "@/core/conversation/etapas"
import { RituError } from "@/core/errors"
import { type EstadoDosLimites, estadoDosLimites } from "@/core/limits/estado"
import { decidirMensagem } from "@/core/limits/mensagens"
import { RunAbertoError } from "@/core/runs/errors"
import type { EventoAoVivo } from "@/core/runs/loop"
import { respostaDaPessoaSchema } from "@/core/runs/pergunta"
import type { TipoDeEtapa } from "@/core/runs/ports"
import type { Container } from "@/infra/container"
import { criarRotaDeFluxo, type Emitir } from "../_lib/fluxo"
import type { DepsDaRota } from "../_lib/rota"
import { runDaConta } from "./conversa"

type ParamsDoRun = { params: Promise<{ id: string }> }

// Etapas ao vivo: só as que têm frase, sem repetir a chave da anterior no mesmo fluxo.
// `antes` roda no primeiro evento (o `inicio` da retomada só sai quando o run de fato anda).
function aoVivoDoFluxo(emitir: Emitir, antes?: () => void): (e: EventoAoVivo) => void {
  let ultima: string | undefined
  return (e) => {
    let frase: FraseDeEtapa | undefined
    if (e.tipo === "etapa_iniciada" && e.etapa.tipo === "interprete") frase = fraseDaEtapa(e.etapa)
    if (e.tipo === "etapa_concluida")
      frase = fraseDaEtapa({ tipo: e.etapa.tipo as TipoDeEtapa, nome: e.etapa.nome }) // gravada pelo loop, só com tipos conhecidos
    antes?.()
    if (!frase || frase.chave === ultima) return
    ultima = frase.chave
    emitir({ tipo: "etapa", frase })
  }
}

type Quem = { ipHash: string; escopo?: string; teto?: number }

function quemDe({ ipHash, escopo, teto }: Quem): Quem {
  return { ipHash, ...(escopo ? { escopo } : {}), ...(teto !== undefined ? { teto } : {}) }
}

async function limitesDe(container: Container, contaId: string, quem: Quem) {
  const { stores, limiter, router, clock, telemetry } = container
  const [conta, perfil] = await Promise.all([
    stores.accounts.buscar(contaId),
    stores.profiles.ler(contaId),
  ])
  if (!conta) throw new RituError("run_nao_encontrado", "Conversa não encontrada")
  const fuso = perfil.cidade_fuso ?? config.clima.fusoPadrao
  return estadoDosLimites({ limiter, router, clock, telemetry }, { conta, fuso, ...quem })
}

// A visão final é relida do banco, depois do run terminar.
async function emitirFim(
  container: Container,
  contaId: string,
  runId: string,
  quem: Quem,
  emitir: Emitir,
) {
  const { stores, clock } = container
  const run = await runDaConta(container, contaId, runId)
  const votos = await stores.runs.votos(contaId, [run.id])
  const [visao, pendentes, limites] = await Promise.all([
    visaoDoRunDaConta(stores, contaId, run, votos[run.id], clock.now()),
    stores.outcomes.pendentes(contaId),
    limitesDe(container, contaId, quem),
  ])
  emitir({ tipo: "fim", visao, pendentes: pendentes.length, limites })
}

// O trabalho segue mesmo se a pessoa fechar a aba: a requisição não é escutada.
export function rotasDeFluxoDeRun(deps: DepsDaRota) {
  const iniciar = async (request: Request): Promise<Response> => {
    // O 429 leva o estado dos limites no corpo: o fluxo genérico só sabe o código.
    let barrada: EstadoDosLimites | undefined
    const resp = await criarRotaDeFluxo(
      deps,
      { corpo: mensagemRecebidaSchema, limite: "nenhum" },
      async (ctx, emitir) => {
        const { conta, corpo, container } = ctx
        const quem = quemDe(ctx)
        if (await container.stores.runs.aberto(conta.id)) throw new RunAbertoError()
        const { limiter, router, clock, telemetry, config: cfg } = container
        const fuso =
          (await container.stores.profiles.ler(conta.id)).cidade_fuso ?? cfg.clima.fusoPadrao
        const decisao = await decidirMensagem(
          { limiter, router, clock, telemetry },
          { conta, fuso, ...quem },
          corpo,
        )
        if ("barrar" in decisao) {
          barrada = await limitesDe(container, conta.id, quem)
          throw decisao.barrar
        }
        const r = await container.conversation.conversar(conta.id, corpo, {
          aoCriar: (run_id) => emitir({ tipo: "inicio", run_id }),
          aoVivo: aoVivoDoFluxo(emitir),
          ...(decisao.seguir === "so_atalhos" ? { semModelo: "limite" as const } : {}),
        })
        await emitirFim(container, conta.id, r.run_id, quem, emitir)
      },
    )(request)
    if (!barrada || resp.status !== 429) return resp
    const erro = ((await resp.json()) as { erro: string }).erro
    return Response.json(
      { erro, limites: barrada },
      { status: 429, headers: { "Retry-After": resp.headers.get("Retry-After") ?? "1" } },
    )
  }

  const responder = async (request: Request, { params }: ParamsDoRun): Promise<Response> => {
    const { id } = await params
    return criarRotaDeFluxo(deps, { corpo: respostaDaPessoaSchema }, async (ctx, emitir) => {
      const { conta, corpo, container } = ctx
      const run = await runDaConta(container, conta.id, id)
      let iniciou = false
      const iniciado = () => {
        if (iniciou) return
        iniciou = true
        emitir({ tipo: "inicio", run_id: run.id })
      }
      await container.conversation.continuar(conta.id, run.id, corpo, {
        aoVivo: aoVivoDoFluxo(emitir, iniciado),
      })
      iniciado()
      await emitirFim(container, conta.id, run.id, quemDe(ctx), emitir)
    })(request)
  }

  return { iniciar, responder }
}
