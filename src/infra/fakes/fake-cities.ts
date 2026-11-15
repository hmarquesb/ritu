import { clima } from "@config/clima"
import { normalizar } from "@/core/knowledge/identificar"
import { type Cidade, type CityLookup, CityLookupUnavailableError } from "@/core/weather/ports"

const CIDADES: Cidade[] = [
  {
    nome: "Rio de Janeiro",
    regiao: "RJ",
    pais: "Brasil",
    lat: -22.91,
    lon: -43.17,
    fuso: "America/Sao_Paulo",
  },
  {
    nome: "São Paulo",
    regiao: "SP",
    pais: "Brasil",
    lat: -23.55,
    lon: -46.63,
    fuso: "America/Sao_Paulo",
  },
  {
    nome: "Belo Horizonte",
    regiao: "MG",
    pais: "Brasil",
    lat: -19.92,
    lon: -43.94,
    fuso: "America/Sao_Paulo",
  },
  {
    nome: "Porto Alegre",
    regiao: "RS",
    pais: "Brasil",
    lat: -30.03,
    lon: -51.23,
    fuso: "America/Sao_Paulo",
  },
  {
    nome: "Recife",
    regiao: "PE",
    pais: "Brasil",
    lat: -8.05,
    lon: -34.88,
    fuso: "America/Sao_Paulo",
  },
  { nome: "Lisboa", pais: "Portugal", lat: 38.72, lon: -9.14, fuso: "Europe/Lisbon" },
]

export function createFakeCities(): CityLookup & { foraDoAr(sim: boolean): void } {
  let foraDoAr = false

  return {
    foraDoAr(sim) {
      foraDoAr = sim
    },
    async buscar(nome) {
      if (foraDoAr) throw new CityLookupUnavailableError()
      const texto = normalizar(nome)
      if (texto.length < clima.busca.minimoCaracteres) return []
      return CIDADES.filter((cidade) => normalizar(cidade.nome).includes(texto)).slice(
        0,
        clima.busca.maximoResultados,
      )
    },
  }
}
