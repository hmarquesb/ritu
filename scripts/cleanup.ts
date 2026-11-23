import { executarLimpeza } from "@/core/cleanup"
import { closeDatabase, getContainer } from "@/infra/container"

async function main(): Promise<number> {
  try {
    const { stores, clock, ledger, limiter, bastidores, telemetry } = getContainer()
    const resultado = await executarLimpeza({
      stores,
      clock,
      ledger,
      limiter,
      bastidores,
      telemetry,
    })
    for (const [item, quantidade] of Object.entries(resultado)) {
      console.log(`${item}: ${quantidade}`)
    }
    return 0
  } catch (erro) {
    // Só a mensagem: o erro bruto do driver pode trazer a URL do banco.
    console.error(erro instanceof Error ? erro.message : "Falha desconhecida na limpeza")
    return 1
  } finally {
    await closeDatabase()
  }
}

process.exitCode = await main()
