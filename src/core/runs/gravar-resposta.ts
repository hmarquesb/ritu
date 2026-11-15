import type { Stores, Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"
import type { Pergunta, RespostaDaPessoa } from "./pergunta"

type Resposta = Extract<RespostaDaPessoa, { tipo: "casa" }>["itens"][number]

async function gravarItem(
  s: Stores,
  contaId: string,
  runId: string,
  dia: string,
  item: Resposta,
): Promise<void> {
  const { alimento_id } = item
  if (item.resposta === "tenho") {
    await s.pantry.registrar(contaId, [{ alimento_id }], "pergunta")
  } else if (item.resposta === "nao_tenho") {
    await s.pantry.marcarAcabou(contaId, [{ alimento_id }])
    await s.shortages.registrar(contaId, [{ alimento_id, origem: "nao_tenho", run_id: runId }], dia)
  } else {
    await s.preferences.definirGosto(contaId, { tipo: "alimento", id: alimento_id }, "nao_gosta")
  }
}

/** Grava, numa transação, o que a pessoa respondeu a uma pergunta de casa. */
export async function gravarResposta(
  deps: { tx: Transactor; telemetry: Telemetry },
  contaId: string,
  runId: string,
  dia: string,
  pergunta: Pergunta,
  resposta: RespostaDaPessoa,
): Promise<void> {
  if (pergunta.tipo !== "casa" || resposta.tipo !== "casa") return
  const perguntados = new Set(pergunta.itens.map((i) => i.alimento_id))
  const itens = resposta.itens.filter((i) => perguntados.has(i.alimento_id))
  if (itens.length === 0) return

  await deps.tx.emTransacao(async (s) => {
    for (const item of itens) await gravarItem(s, contaId, runId, dia, item)
  })

  for (const item of itens) {
    if (item.resposta === "nao_tenho") {
      deps.telemetry.contador("ritu_faltas_total", { origem: "nao_tenho" })
    } else if (item.resposta === "nao_gosto") {
      deps.telemetry.contador("ritu_gosto_total", { gosto: "nao_gosta" })
    }
  }
}
