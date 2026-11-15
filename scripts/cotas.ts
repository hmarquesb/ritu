// Tabela de uso do registro de cotas: pedidos e tokens do minuto e do dia, por modelo de config/llm-cotas.ts.
// Uso: npm run cotas
import { llmCotas } from "@config/index"
import type { Limites, UsoDoModelo } from "@/core/llm/ledger"
import { getContainer } from "@/infra/container"

function porcentagem(usado: number, limite: number): string {
  return `${Math.round((usado / limite) * 100)}%`
}

function usoZerado(modelo: string): UsoDoModelo {
  return {
    modelo,
    minuto: { pedidos: 0, tokens: 0 },
    dia: { pedidos: 0, tokens: 0, rate_limits: 0 },
  }
}

export function linhaDoUso(uso: UsoDoModelo, limites: Limites): string {
  const partes = [
    uso.modelo,
    `minuto ${uso.minuto.pedidos}/${limites.rpm} pedidos (${porcentagem(uso.minuto.pedidos, limites.rpm)})`,
    `${uso.minuto.tokens}/${limites.tpm} tokens (${porcentagem(uso.minuto.tokens, limites.tpm)})`,
    `dia ${uso.dia.pedidos}/${limites.rpd} pedidos (${porcentagem(uso.dia.pedidos, limites.rpd)})`,
    `${uso.dia.tokens} tokens`,
  ]
  if (uso.esgotado_ate) partes.push(`esgotado_ate: ${uso.esgotado_ate}`)
  return partes.join("  ")
}

async function main(): Promise<number> {
  const container = getContainer()
  try {
    const porModelo = new Map((await container.ledger.uso()).map((uso) => [uso.modelo, uso]))
    for (const [modelo, limites] of Object.entries(llmCotas.modelos)) {
      console.log(linhaDoUso(porModelo.get(modelo) ?? usoZerado(modelo), limites))
    }
    return 0
  } catch (erro) {
    // Só a mensagem: o erro bruto do driver pode trazer a URL do banco.
    console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao ler o uso")
    return 1
  } finally {
    await container.encerrar()
  }
}

process.exitCode = await main()
