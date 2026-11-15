// ⚠️ Chama a rede real (Gemini, com GEMINI_API_KEY). Opt-in: roda só à mão, nunca nos gates nem na CI.
// Uso: npm run modelos:check
import { llmCotas } from "@config/index"
import { z } from "zod"
import { LlmError } from "@/core/llm/errors"
import type { Limites } from "@/core/llm/ledger"
import { type Container, getContainer } from "@/infra/container"

const schema = z.object({ ok: z.boolean() })

// Pedido mínimo: não carrega texto de pessoa nem prompt de produto.
const INSTRUCOES = 'Responda somente com o JSON {"ok": true}.'
const ENTRADA = "Teste de disponibilidade."

async function chamarModelo(container: Container, modelo: string): Promise<void> {
  try {
    const { tokens } = await container.llm.gerar({
      modelo,
      instrucoes: INSTRUCOES,
      entrada: ENTRADA,
      schema,
      timeoutMs: llmCotas.timeoutMs,
    })
    const total = tokens.entrada + tokens.saida
    await container.ledger.registrarTokens(modelo, total)
    console.log(`${modelo}  ok  ${total}`)
  } catch (erro) {
    if (!(erro instanceof LlmError)) throw erro
    if (erro.code === "rate_limit") await container.ledger.registrarRateLimit(modelo)
    console.log(`${modelo}  ${erro.code}`)
  }
}

async function checarModelo(container: Container, modelo: string, limites: Limites): Promise<void> {
  if (!(await container.ledger.reservar(modelo, limites))) {
    console.log(`${modelo}  sem vaga`)
    return
  }
  await chamarModelo(container, modelo)
}

async function main(): Promise<number> {
  const container = getContainer()
  try {
    for (const [modelo, limites] of Object.entries(llmCotas.modelos)) {
      await checarModelo(container, modelo, limites)
    }
    return 0
  } catch (erro) {
    // Só a mensagem: o erro bruto do driver pode trazer a URL do banco.
    console.error(erro instanceof Error ? erro.message : "Falha desconhecida na checagem")
    return 1
  } finally {
    await container.encerrar()
  }
}

process.exitCode = await main()
