import { llmCotas, type Papel } from "@config/llm-cotas"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { Telemetry } from "@/core/telemetry/ports"
import type { LlmError } from "./errors"
import type { FornecedorDeModelo } from "./fornecedor"
import type { Limites, UsageLedger, UsoDoModelo } from "./ledger"
import { rotaDe, separarRota } from "./rota"

export { diaDaCota, janelaDoMinuto } from "./janelas"

export type Troca = {
  papel: Papel
  de: string
  para: string
  motivo: "cota" | "429"
  chave_de?: number
  chave_para?: number
}

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
  /** Chaves configuradas, na ordem de uso. Padrão: [1]. */
  chaves?: readonly number[]
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
  const chaves = deps.chaves ?? [1]
  const modelos: Record<string, Limites> = cotas.modelos

  for (const [papel, lista] of Object.entries(cotas.papeis)) {
    for (const m of lista) {
      if (!modelos[m]) {
        throw new RituError("config_invalida", `Papel ${papel} usa modelo fora de modelos: ${m}`)
      }
    }
  }

  function rotasDe(modelo: string): string[] {
    return chaves.map((c) => rotaDe(modelo, c, chaves.length))
  }

  function limitesDa(rota: string): Limites | undefined {
    return modelos[separarRota(rota).modelo]
  }

  function filaDo(papel: Papel): string[] {
    return cotas.papeis[papel].flatMap(rotasDe)
  }

  function medirCota(rota: string, uso: UsoDoModelo[]): void {
    const u = uso.find((x) => x.modelo === rota)
    const l = limitesDa(rota)
    const modelo = separarRota(rota).modelo
    if (!u || !l) return
    telemetry.medidor("ritu_llm_cota_usada", u.minuto.pedidos / l.rpm, { modelo, janela: "minuto" })
    telemetry.medidor("ritu_llm_cota_usada", u.dia.pedidos / l.rpd, { modelo, janela: "dia" })
  }

  async function reservarEMedir(rota: string): Promise<boolean> {
    const limites = limitesDa(rota)
    if (!limites || !(await ledger.reservar(rota, limites))) return false
    medirCota(rota, await ledger.uso())
    return true
  }

  function trocaEntre(papel: Papel, de: string, para: string, motivo: "cota" | "429"): Troca {
    const a = separarRota(de)
    const b = separarRota(para)
    const troca: Troca = { papel, de: a.modelo, para: b.modelo, motivo }
    if (a.modelo === b.modelo) return { ...troca, chave_de: a.chave, chave_para: b.chave }
    return troca
  }

  function inicioDe(lista: readonly string[], preferir?: string): string[] {
    if (!preferir) return []
    if (lista.includes(preferir)) return [preferir]
    const pura = lista.filter((r) => separarRota(r).modelo === preferir)
    return pura
  }

  function anunciarTroca(t: Troca, aoTrocar?: (t: Troca) => void): void {
    aoTrocar?.(t)
    const rotulos = { papel: t.papel, de: t.de, para: t.para, motivo: t.motivo }
    telemetry.contador("ritu_llm_troca_de_modelo_total", rotulos)
    telemetry.log("troca_de_modelo", rotulos)
  }

  return {
    paraPapel(papel, opts = {}) {
      const lista = filaDo(papel)
      const inicio = inicioDe(lista, opts.preferir)
      let anterior = inicio[0] ?? lista[0] ?? ""
      let houve429 = false

      return {
        async proximo() {
          const tentativas = [...new Set([...inicio, ...lista])]
          for (const rota of tentativas) {
            if (!(await reservarEMedir(rota))) continue
            if (rota === anterior) return { modelo: rota }
            const de = anterior
            const motivo = houve429 ? "429" : "cota"
            houve429 = false
            anterior = rota
            anunciarTroca(trocaEntre(papel, de, rota, motivo), opts.aoTrocar)
            return { modelo: rota, troca: { de, motivo } }
          }
          telemetry.log("sem_modelo", { papel })
          return null
        },
        async usou(rota, tokens, duracaoMs) {
          const { modelo } = separarRota(rota)
          await ledger.registrarTokens(rota, tokens.entrada + tokens.saida)
          telemetry.contador("ritu_llm_chamadas_total", { modelo, papel })
          telemetry.contador(
            "ritu_tokens_total",
            { modelo, papel, direcao: "entrada" },
            tokens.entrada,
          )
          telemetry.contador("ritu_tokens_total", { modelo, papel, direcao: "saida" }, tokens.saida)
          telemetry.histograma("ritu_llm_duracao_ms", duracaoMs, { modelo, papel })
        },
        async falhou(rota, erro: LlmError) {
          const { modelo } = separarRota(rota)
          if (erro.code === "rate_limit") {
            await ledger.registrarRateLimit(rota)
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
      return filaDo(papel).some((r) =>
        temVaga(
          uso.find((u) => u.modelo === r),
          limitesDa(r) as Limites,
        ),
      )
    },

    async cotaDoDiaEsgotada(papel) {
      const uso = await ledger.uso()
      return filaDo(papel).every((r) => {
        const u = uso.find((x) => x.modelo === r)
        const diaCheio = (u?.dia.pedidos ?? 0) >= (limitesDa(r) as Limites).rpd
        return u?.esgotado_ate === "dia" || diaCheio
      })
    },
  }
}
