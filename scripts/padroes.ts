import { closeDatabase, getContainer } from "@/infra/container"

async function main(): Promise<number> {
  try {
    const { patterns } = getContainer()
    const resultado = await patterns.detectarPadroes()
    console.log(`contas: ${resultado.contas}`)
    console.log(`propostos: ${resultado.propostos}`)
    console.log(`falhas: ${resultado.falhas}`)
    return 0
  } catch (erro) {
    // Só a mensagem: o erro bruto do driver pode trazer a URL do banco.
    console.error(
      erro instanceof Error ? erro.message : "Falha desconhecida na detecção de padrões",
    )
    return 1
  } finally {
    await closeDatabase()
  }
}

process.exitCode = await main()
