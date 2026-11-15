import { RituError } from "@/core/errors"

export type Coordenadas = { lat: number; lon: number } // duas casas decimais
export type Cidade = {
  nome: string
  regiao?: string
  pais: string
  lat: number
  lon: number
  fuso: string
}
export type CidadeDaPessoa = { nome: string; lat: number; lon: number; fuso: string }

export type PrevisaoHora = { hora: string; temperatura_aparente: number; prob_chuva: number } // hora em ISO
export type Clima = {
  temperatura_aparente: number // °C
  umidade: number // %
  observado_em: string // ISO
  proximas_horas: PrevisaoHora[] // 6 horas a partir da próxima
}

export interface WeatherSource {
  buscar(c: Coordenadas): Promise<Clima> // lança WeatherUnavailableError
}

export interface CityLookup {
  buscar(nome: string): Promise<Cidade[]> // lança CityLookupUnavailableError
}

export class WeatherUnavailableError extends RituError {
  constructor(message = "Não consegui consultar o clima agora.") {
    super("clima_indisponivel", message)
    this.name = "WeatherUnavailableError"
  }
}

export class CityLookupUnavailableError extends RituError {
  constructor(message = "Não consegui buscar a cidade agora.") {
    super("cidades_indisponivel", message)
    this.name = "CityLookupUnavailableError"
  }
}
