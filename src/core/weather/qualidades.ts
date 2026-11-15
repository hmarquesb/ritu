import { clima } from "@config/clima"
import type { Guna } from "@/core/knowledge/vocab"
import type { Clima } from "./ports"

export type FaixaTemperatura = "frio" | "neutro" | "quente"
export type FaixaUmidade = "seco" | "neutro" | "umido"

const GUNA_DA_TEMPERATURA: Record<FaixaTemperatura, Guna | null> = {
  frio: "frio",
  neutro: null,
  quente: "quente",
}

const GUNA_DA_UMIDADE: Record<FaixaUmidade, Guna | null> = {
  seco: "seco",
  neutro: null,
  umido: "oleoso",
}

export function climaEmQualidades(c: Pick<Clima, "temperatura_aparente" | "umidade">): {
  faixa_temperatura: FaixaTemperatura
  faixa_umidade: FaixaUmidade
  gunas: Guna[]
} {
  const faixa_temperatura = faixaDeTemperatura(c.temperatura_aparente)
  const faixa_umidade = faixaDeUmidade(c.umidade)
  const gunas = [GUNA_DA_TEMPERATURA[faixa_temperatura], GUNA_DA_UMIDADE[faixa_umidade]].filter(
    (g): g is Guna => g !== null,
  )
  return { faixa_temperatura, faixa_umidade, gunas }
}

function faixaDeTemperatura(temperatura: number): FaixaTemperatura {
  if (temperatura < clima.temperaturaAparente.frioAbaixoDe) return "frio"
  if (temperatura > clima.temperaturaAparente.quenteAcimaDe) return "quente"
  return "neutro"
}

function faixaDeUmidade(umidade: number): FaixaUmidade {
  if (umidade < clima.umidade.secoAbaixoDe) return "seco"
  if (umidade > clima.umidade.umidoAcimaDe) return "umido"
  return "neutro"
}
