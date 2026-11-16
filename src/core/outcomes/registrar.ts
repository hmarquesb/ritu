import type { Resultado, Retorno } from "@/core/outcomes/ports"
import type { Transactor } from "@/core/stores"
import type { Telemetry } from "@/core/telemetry/ports"

type Item = { tipo: "alimento" | "pratica" | "preparo"; id: string }

function itensDoRetorno(retorno: Retorno): Item[] {
  const { sugestao } = retorno
  const itens: Item[] = []
  if (sugestao.pratica_id) itens.push({ tipo: "pratica", id: sugestao.pratica_id })
  else if (sugestao.preparo_id) itens.push({ tipo: "preparo", id: sugestao.preparo_id })
  for (const id of sugestao.alimentos) itens.push({ tipo: "alimento", id })
  return itens
}

export async function registrarResultado(
  deps: { tx: Transactor; telemetry: Telemetry },
  contaId: string,
  retornoId: string,
  resultado: Resultado,
  origem: "toque" | "conversa",
): Promise<Retorno | undefined> {
  const r = await deps.tx.emTransacao(async (s) => {
    const resposta = await s.outcomes.responder(contaId, retornoId, resultado, origem)
    if (!resposta?.mudou) return resposta
    for (const item of itensDoRetorno(resposta.retorno)) {
      await s.preferences.contarResultado(contaId, item, resultado)
    }
    return resposta
  })
  if (r?.mudou) deps.telemetry.contador("ritu_retorno_total", { resultado, origem })
  return r?.retorno
}
