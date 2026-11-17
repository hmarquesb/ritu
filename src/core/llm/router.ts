import { llmCotas, type Papel } from "@config/llm-cotas"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { Telemetry } from "@/core/telemetry/ports"
import type { LlmError } from "./errors"
import type { FornecedorDeModelo } from "./fornecedor"
import type { Limites, UsageLedger, UsoDoModelo } from "./ledger"

export { diaDaCota, janelaDoMinuto } from "./janelas"

export type Troca = { papel: Papel; de: string; para: string; motivo: "cota" | "429" }

export interface ModelRouter {
  paraPapel(
    papel: Papel,
    opts?: { preferir?: string; aoTrocar?: (t: Troca) => void },
  ): FornecedorDeModelo
  temModelo(papel: Papel): Promise<boolean>
  /** Verdadeiro quando todo modelo do papel esgotou o dia (cota diária ou 429 do dia). A cota do minuto não conta. */
  cotaDoDiaEsgotada(papel: Papel): Promise<boolean>
}

type Deps = {
  ledger: UsageLedger
  clock: Clock
  telemetry: Telemetry
  cotas?: typeof llmCotas
}

function temVaga(uso: UsoDoModelo | undefined, l: Limites): boolean {
  if (uso?.esgotado_ate) return false
  const minuto = uso?.minuto ?? { pedidos: 0, tokens: 0 }
  const dia = uso?.dia ?? { pedidos: 0 }
  return minuto.pedidos < l.rpm && minuto.tokens < l.tpm && dia.pedidos < l.rpd
}

export function createModelRouter(deps: Deps): ModelRouter {
  const { ledger, telemetry } = deps
  const cotas = deps.cotas ?? llmCotas
  const modelos: Record<string, Limites> = cotas.modelos

  for (const [papel, lista] of Object.entries(cotas.papeis)) {
    for (const m of lista) {
      if (!modelos[m]) {
        throw new RituError("config_invalida", `Papel ${papel} usa modelo fora de modelos: ${m}`)
      }
    }
  }

  function medirCota(modelo: string, uso: UsoDoModelo[]): void {
    const u = uso.find((x) => x.modelo === modelo)
    const l = modelos[modelo]
    if (!u || !l) return
    telemetry.medidor("ritu_llm_cota_usada", u.minuto.pedidos / l.rpm, { modelo, janela: "minuto" })
    telemetry.medidor("ritu_llm_cota_usada", u.dia.pedidos / l.rpd, { modelo, janela: "dia" })
  }

  async function reservarEMedir(modelo: string): Promise<boolean> {
    const limites = modelos[modelo]
    if (!limites || !(await ledger.reservar(modelo, limites))) return false
    medirCota(modelo, await ledger.uso())
    return true
  }

  function anunciarTroca(t: Troca, aoTrocar?: (t: Troca) => void): void {
    aoTrocar?.(t)
    const rotulos = { papel: t.papel, de: t.de, para: t.para, motivo: t.motivo }
    telemetry.contador("ritu_llm_troca_de_modelo_total", rotulos)
    telemetry.log("troca_de_modelo", rotulos)
  }

  return {
    paraPapel(papel, opts = {}) {
      const lista: readonly string[] = cotas.papeis[papel]
      const inicio = opts.preferir && lista.includes(opts.preferir) ? [opts.preferir] : []
      let anterior = inicio[0] ?? lista[0] ?? ""
      let houve429 = false

      return {
        async proximo() {
          const tentativas = [...new Set([...inicio, ...lista])]
          for (const modelo of tentativas) {
            if (!(await reservarEMedir(modelo))) continue
            if (modelo === anterior) return { modelo }
            const de = anterior
            const motivo = houve429 ? "429" : "cota"
            houve429 = false
            anterior = modelo
            anunciarTroca({ papel, de, para: modelo, motivo }, opts.aoTrocar)
            return { modelo, troca: { de, motivo } }
          }
          telemetry.log("sem_modelo", { papel })
          return null
        },
        async usou(modelo, tokens, duracaoMs) {
          await ledger.registrarTokens(modelo, tokens.entrada + tokens.saida)
          telemetry.contador("ritu_llm_chamadas_total", { modelo, papel })
          telemetry.contador(
            "ritu_tokens_total",
            { modelo, papel, direcao: "entrada" },
            tokens.entrada,
          )
          telemetry.contador("ritu_tokens_total", { modelo, papel, direcao: "saida" }, tokens.saida)
          telemetry.histograma("ritu_llm_duracao_ms", duracaoMs, { modelo, papel })
        },
        async falhou(modelo, erro: LlmError) {
          if (erro.code === "rate_limit") {
            await ledger.registrarRateLimit(modelo)
            houve429 = true
          }
          const rotulos = { modelo, papel, codigo: erro.code }
          telemetry.contador("ritu_llm_erros_total", rotulos)
          telemetry.log("llm_erro", rotulos)
        },
      }
    },

    async temModelo(papel) {
      const uso = await ledger.uso()
      return cotas.papeis[papel].some((m) =>
        temVaga(
          uso.find((u) => u.modelo === m),
          modelos[m] as Limites,
        ),
      )
    },

    async cotaDoDiaEsgotada(papel) {
      const uso = await ledger.uso()
      return cotas.papeis[papel].every((m) => {
        const u = uso.find((x) => x.modelo === m)
        const diaCheio = (u?.dia.pedidos ?? 0) >= (modelos[m] as Limites).rpd
        return u?.esgotado_ate === "dia" || diaCheio
      })
    },
  }
}
