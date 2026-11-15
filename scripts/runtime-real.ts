// ⚠️ Chama a rede real (Gemini, com GEMINI_API_KEY). Opt-in: roda só à mão, nunca nos gates nem na CI.
// Uso: npm run runtime:real -- <modelo>
import { z } from "zod"
import { getContainer } from "@/infra/container"

const USO = "Uso: npm run runtime:real -- <modelo>"

async function main(): Promise<void> {
  const modelo = process.argv[2]
  if (!modelo) {
    console.log(USO)
    process.exit(2)
  }
  const container = getContainer()
  try {
    const resultado = await container.runtime.passo({
      instrucoes: "Você é um assistente de teste. Use as tools quando pedido.",
      mensagens: [{ papel: "pessoa", conteudo: "Que horas são? Use a tool." }],
      tools: [{ name: "hora_atual", description: "Devolve a hora atual.", input: z.object({}) }],
      modelo,
      timeoutMs: 15_000,
    })
    console.log("Chamadas pedidas:", JSON.stringify(resultado.chamadas))
    if (resultado.texto) console.log("Texto:", resultado.texto)
    console.log(
      `Tokens: ${resultado.tokens_entrada} de entrada, ${resultado.tokens_saida} de saída`,
    )
  } finally {
    await container.encerrar()
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
