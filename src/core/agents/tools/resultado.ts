import { z } from "zod"
import { registrarResultado } from "@/core/outcomes/registrar"
import { definirTool } from "@/core/tools/tool"

type RecusaDeResultado = "sem_retorno" | "ja_registrado" | "fora_dos_pendentes"

type ResultadoDoRegistro =
  | { registrado: true; titulo: string }
  | { registrado: false; motivo: RecusaDeResultado }

const resultadoSchema: z.ZodType<ResultadoDoRegistro> = z.union([
  z.object({ registrado: z.literal(true), titulo: z.string() }),
  z.object({
    registrado: z.literal(false),
    motivo: z.enum(["sem_retorno", "ja_registrado", "fora_dos_pendentes"]),
  }),
])

function recusa(motivo: RecusaDeResultado): ResultadoDoRegistro {
  return { registrado: false, motivo }
}

// Liga o retorno contado na conversa ao pendente certo. O resultado vem sempre do run
// (do Intérprete); a tool recebe só o número da sugestão.
export const resultadoRegistrar = definirTool<{ pendente: number }, ResultadoDoRegistro>({
  name: "resultado.registrar",
  description:
    "Anota como foi uma sugestão anterior, quando a pessoa contou isso na mensagem. Passe o número da sugestão em retornos_pendentes.",
  input: z.object({ pendente: z.number().int() }),
  output: resultadoSchema,
  resumir: (saida) => (saida.registrado ? "registrado" : `recusado: ${saida.motivo}`),
  async executar(entrada, ctx) {
    const retorno = ctx.run?.retorno
    if (!ctx.run || !retorno) return recusa("sem_retorno")
    if (retorno.registrado) return recusa("ja_registrado")
    const alvo = (ctx.run.pendentes ?? []).find((p) => p.n === entrada.pendente)
    if (!alvo) return recusa("fora_dos_pendentes")
    if (!ctx.tx) throw new Error("resultado.registrar sem transação")
    const aguardando = await ctx.stores.outcomes.pendentes(ctx.contaId)
    if (!aguardando.some((r) => r.id === alvo.retorno_id)) return recusa("ja_registrado")
    const registrado = await registrarResultado(
      { tx: ctx.tx, telemetry: ctx.telemetry },
      ctx.contaId,
      alvo.retorno_id,
      retorno.resultado,
      "conversa",
    )
    if (!registrado) return recusa("ja_registrado")
    retorno.registrado = true
    return { registrado: true, titulo: registrado.sugestao.titulo }
  },
})
