import { describe, expect, it } from "vitest"
import { montarMensagemInicial } from "@/core/agents/companion/contexto"
import { preparar } from "@/core/agents/companion/preparo"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { acompanhanteV7 } from "./acompanhante.v7"
import { acompanhanteV8 } from "./acompanhante.v8"

async function contexto(): Promise<Record<string, unknown>> {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const base = await preparar(
    {
      stores: createMemoryStores(clock),
      kb: createMiniKnowledge(),
      clock,
      telemetry: createMemoryTelemetry(),
    },
    "conta-1",
    { intencoes: ["momento"], estados: ["com_frio", "agitada"], evitar_da_mensagem: [] },
  )
  const dados = {
    ...base,
    qualidades: {
      ...base.qualidades,
      presentes:
        base.qualidades.presentes.length > 0
          ? base.qualidades.presentes
          : (["frio"] as typeof base.qualidades.presentes),
      buscadas:
        base.qualidades.buscadas.length > 0
          ? base.qualidades.buscadas
          : (["quente"] as typeof base.qualidades.buscadas),
      conflitos: [["frio", "quente"]] as typeof base.qualidades.conflitos,
      evitar_gunas: ["frio"] as typeof base.qualidades.evitar_gunas,
    },
  }
  const msg = montarMensagemInicial(dados, "oi")
  const m = /^<contexto>\n([\s\S]*)\n<\/contexto>/.exec(msg)
  return JSON.parse(m?.[1] ?? "{}")
}

describe("acompanhanteV8", () => {
  const texto = acompanhanteV8.instrucoes

  it("tem a versão acompanhante.v8 e o mesmo lembrete do v7", () => {
    expect(acompanhanteV8.versao).toBe("acompanhante.v8")
    expect(acompanhanteV8.lembreteDeEntrega).toBe(acompanhanteV7.lembreteDeEntrega)
  })

  it("não usa o caminho antigo qualidades.", () => {
    expect(texto).not.toContain("qualidades.")
  })

  it("todo momento.<campo> citado existe no contexto montado", async () => {
    const citados = [...texto.matchAll(/momento\.([a-z_]+)/g)].map((m) => m[1] as string)
    expect(new Set(citados)).toEqual(new Set(["presentes", "buscadas", "conflitos", "evitar"]))
    const momento = (await contexto()).momento as Record<string, unknown>
    for (const campo of citados) expect(momento).toHaveProperty(campo)
  })

  it("descreve a entrada de finalizar", () => {
    for (const termo of ["finalizar", "escolhas", "trocas", "para_ter"]) {
      expect(texto).toContain(termo)
    }
  })

  it("não manda copiar linha_base, contribui nem novidade", () => {
    expect(texto).not.toMatch(/copi\w+[^.\n]*(linha_base|contribui|novidade)/i)
    expect(texto).toContain("montado pelo código")
  })
})
