import type { NumerosDaSemana } from "@/core/bastidores/numeros"

const JANELA = { de: "2026-11-02", ate: "2026-11-08" }

const ABAIXO_DO_PISO: NumerosDaSemana = { tipo: "poucos", janela: JANELA, runs: 7, minimo: 20 }

const ACIMA_DO_PISO: NumerosDaSemana = {
  tipo: "ok",
  janela: JANELA,
  runs: {
    runs: 42,
    duracao_p50_ms: 3400,
    passos_medios: 4.5,
    juiz: { julgados: 40, refeitas: 6 },
    trocas_de_modelo: 2,
    intencoes: [
      { intencao: "momento", total: 20 },
      { intencao: "pergunta", total: 12 },
      { intencao: "casa", total: 6 },
      { intencao: "nova_intencao", total: 4 },
    ],
    tools: [
      { tool: "ayurveda.candidatos", total: 31 },
      { tool: "clima.agora", total: 18 },
      { tool: "casa.ler", total: 9 },
    ],
  },
  sinais: {
    feedback: { up: 11, down: 2 },
    retornos: { ajudou: 8, nao_ajudou: 1, nao_fez: 3 },
  },
}

/** Valor do header `x-ritu-e2e-bastidores` do pedido em andamento; fora de pedido, `undefined`. */
async function cenarioDoPedido(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers")
    return (await headers()).get("x-ritu-e2e-bastidores")?.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * Números fixos para o E2E: `poucos` abaixo do piso e `ok` acima. Sem o header, `undefined` e a
 * página lê do container. Quem chama só usa isto no modo e2e.
 */
export async function numerosDoE2e(): Promise<NumerosDaSemana | undefined> {
  const cenario = await cenarioDoPedido()
  if (cenario === "poucos") return ABAIXO_DO_PISO
  if (cenario === "ok") return ACIMA_DO_PISO
  return undefined
}
