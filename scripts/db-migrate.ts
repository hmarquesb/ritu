import { closeDatabase, migrateDatabase } from "@/infra/container"

async function main(): Promise<number> {
  try {
    const aplicadas = await migrateDatabase()
    console.log(aplicadas.length > 0 ? `Aplicadas: ${aplicadas.join(", ")}` : "Nada a aplicar")
    return 0
  } catch (erro) {
    // Só a mensagem: o erro bruto do driver pode trazer a URL do banco.
    console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao migrar")
    return 1
  } finally {
    await closeDatabase()
  }
}

process.exitCode = await main()
