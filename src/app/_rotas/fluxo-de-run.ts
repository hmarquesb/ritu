import { mensagemRecebidaSchema } from "@/core/conversation/conversar"
import { visaoDoRunDaConta } from "@/core/conversation/do-dia"
import { type FraseDeEtapa, fraseDaEtapa } from "@/core/conversation/etapas"
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

// A visão final é relida do banco, depois do run terminar.
async function emitirFim(container: Container, contaId: string, runId: string, emitir: Emitir) {
  const { stores, clock } = container
  const run = await runDaConta(container, contaId, runId)
  const votos = await stores.runs.votos(contaId, [run.id])
  const [visao, pendentes] = await Promise.all([
    visaoDoRunDaConta(stores, contaId, run, votos[run.id], clock.now()),
    stores.outcomes.pendentes(contaId),
  ])
  emitir({ tipo: "fim", visao, pendentes: pendentes.length })
}

// O trabalho segue mesmo se a pessoa fechar a aba: a requisição não é escutada.
export function rotasDeFluxoDeRun(deps: DepsDaRota) {
  const iniciar = criarRotaDeFluxo(
    deps,
    { corpo: mensagemRecebidaSchema },
    async ({ conta, corpo, container }, emitir) => {
      const r = await container.conversation.conversar(conta.id, corpo, {
        aoCriar: (run_id) => emitir({ tipo: "inicio", run_id }),
        aoVivo: aoVivoDoFluxo(emitir),
      })
      await emitirFim(container, conta.id, r.run_id, emitir)
    },
  )

  const responder = async (request: Request, { params }: ParamsDoRun): Promise<Response> => {
    const { id } = await params
    return criarRotaDeFluxo(
      deps,
      { corpo: respostaDaPessoaSchema },
      async ({ conta, corpo, container }, emitir) => {
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
        await emitirFim(container, conta.id, run.id, emitir)
      },
    )(request)
  }

  return { iniciar, responder }
}
