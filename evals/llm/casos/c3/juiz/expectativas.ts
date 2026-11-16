import type { Veredito } from "@/core/agents/judge/julgar"
import type { MotivoDoJuiz } from "@/core/agents/judge/saida"
import type { ExpectativaDoJuiz } from "../tipos"

const exp = (descricao: string, confere: (v: Veredito) => boolean): ExpectativaDoJuiz => ({
  descricao,
  confere,
})

// O Juiz leu a resposta e devolveu um veredito sem erro de formato.
export const vereditoValido = (): ExpectativaDoJuiz => exp("veredito válido", (v) => v.ok)

export const aprovado = (): ExpectativaDoJuiz => exp("aprova a resposta", (v) => v.ok && v.aprovado)

export const reprovado = (): ExpectativaDoJuiz =>
  exp("reprova a resposta", (v) => v.ok && !v.aprovado)

export const aponta = (motivo: MotivoDoJuiz): ExpectativaDoJuiz =>
  exp(`aponta ${motivo}`, (v) => v.ok && v.apontamentos.some((a) => a.motivo === motivo))

export const naoAponta = (motivo: MotivoDoJuiz): ExpectativaDoJuiz =>
  exp(`não aponta ${motivo}`, (v) => v.ok && !v.apontamentos.some((a) => a.motivo === motivo))

// Nenhum apontamento, de nenhum motivo (nem os de registro).
export const nenhumApontamento = (): ExpectativaDoJuiz =>
  exp("nenhum apontamento", (v) => v.ok && v.apontamentos.length === 0)
