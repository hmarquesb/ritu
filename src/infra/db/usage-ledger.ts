import { llmCotas } from "@config/llm-cotas"
import type { Clock } from "@/core/clock"
import { diaDaCota, janelaDoMinuto } from "@/core/llm/janelas"
import type { UsageLedger, UsoDoModelo } from "@/core/llm/ledger"
import { type Conexao, numaTransacao } from "./mappers"

const MS_DIA = 24 * 60 * 60 * 1000

type LinhaRow = {
  janela: "minuto" | "dia"
  pedidos: number
  tokens: number
  rate_limits: number
  esgotado: boolean
}

// Registro de uso no Postgres. As duas linhas correntes são sempre travadas na mesma
// ordem (minuto, depois dia), então reservas simultâneas se enfileiram sem deadlock.
export function createPgUsageLedger(sql: Conexao, clock: Clock): UsageLedger {
  const correntes = () => {
    const agora = clock.now()
    return { minuto: janelaDoMinuto(agora), dia: diaDaCota(agora) }
  }

  async function garantir(
    tx: Conexao,
    modelo: string,
    c: { minuto: string; dia: string },
  ): Promise<void> {
    await tx`
      insert into llm_uso (modelo, janela, inicio)
      values (${modelo}, 'minuto', ${c.minuto}), (${modelo}, 'dia', ${c.dia})
      on conflict do nothing`
  }

  async function travar(tx: Conexao, modelo: string, c: { minuto: string; dia: string }) {
    const linhas = await tx<LinhaRow[]>`
      select janela, pedidos, tokens, rate_limits, esgotado from llm_uso
      where modelo = ${modelo}
        and ((janela = 'minuto' and inicio = ${c.minuto}) or (janela = 'dia' and inicio = ${c.dia}))
      order by janela desc
      for update`
    const minuto = linhas.find((l) => l.janela === "minuto")
    const dia = linhas.find((l) => l.janela === "dia")
    if (!minuto || !dia) throw new Error("linhas de uso ausentes")
    return { minuto, dia }
  }

  return {
    async reservar(modelo, limites) {
      const c = correntes()
      return numaTransacao(sql, async (tx) => {
        await garantir(tx, modelo, c)
        const { minuto, dia } = await travar(tx, modelo, c)
        if (minuto.esgotado || dia.esgotado) return false
        if (minuto.pedidos >= limites.rpm || minuto.tokens >= limites.tpm) return false
        if (dia.pedidos >= limites.rpd) return false
        await tx`
          update llm_uso set pedidos = pedidos + 1
          where modelo = ${modelo}
            and ((janela = 'minuto' and inicio = ${c.minuto}) or (janela = 'dia' and inicio = ${c.dia}))`
        return true
      })
    },

    async registrarTokens(modelo, tokens) {
      const c = correntes()
      await numaTransacao(sql, async (tx) => {
        await garantir(tx, modelo, c)
        await travar(tx, modelo, c)
        await tx`
          update llm_uso set tokens = tokens + ${tokens}
          where modelo = ${modelo}
            and ((janela = 'minuto' and inicio = ${c.minuto}) or (janela = 'dia' and inicio = ${c.dia}))`
      })
    },

    async registrarRateLimit(modelo) {
      const c = correntes()
      await numaTransacao(sql, async (tx) => {
        await garantir(tx, modelo, c)
        await travar(tx, modelo, c)
        await tx`
          update llm_uso set esgotado = true
          where modelo = ${modelo} and janela = 'minuto' and inicio = ${c.minuto}`
        await tx`
          update llm_uso
          set rate_limits = rate_limits + 1,
              esgotado = (rate_limits + 1 >= ${llmCotas.rateLimitsParaEsgotarODia})
          where modelo = ${modelo} and janela = 'dia' and inicio = ${c.dia}`
      })
    },

    async uso() {
      const c = correntes()
      const linhas = await sql<(LinhaRow & { modelo: string })[]>`
        select modelo, janela, pedidos, tokens, rate_limits, esgotado from llm_uso
        where (janela = 'minuto' and inicio = ${c.minuto}) or (janela = 'dia' and inicio = ${c.dia})`
      return Object.keys(llmCotas.modelos).map((modelo): UsoDoModelo => {
        const minuto = linhas.find((l) => l.modelo === modelo && l.janela === "minuto")
        const dia = linhas.find((l) => l.modelo === modelo && l.janela === "dia")
        const item: UsoDoModelo = {
          modelo,
          minuto: { pedidos: minuto?.pedidos ?? 0, tokens: minuto?.tokens ?? 0 },
          dia: {
            pedidos: dia?.pedidos ?? 0,
            tokens: dia?.tokens ?? 0,
            rate_limits: dia?.rate_limits ?? 0,
          },
        }
        if (dia?.esgotado) item.esgotado_ate = "dia"
        else if (minuto?.esgotado) item.esgotado_ate = "minuto"
        return item
      })
    },

    // Minuto com mais de 1 dia e dia com mais de 30; o dia (AAAA-MM-DD) vale meia-noite UTC.
    async apagarAntigas() {
      const agora = clock.now().getTime()
      const corteMinuto = new Date(agora - MS_DIA).toISOString()
      const corteDia = new Date(agora - 30 * MS_DIA).toISOString()
      const apagadas = await sql`
        delete from llm_uso
        where (janela = 'minuto' and inicio::timestamptz < ${corteMinuto}::timestamptz)
           or (janela = 'dia'
               and (inicio::date)::timestamp < (${corteDia}::timestamptz at time zone 'UTC'))`
      return apagadas.count
    },
  }
}
