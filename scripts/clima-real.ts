// ⚠️ Chama a rede real (Open-Meteo e geocodificação). Opt-in: roda só à mão, nunca nos gates nem na CI.
// Uso: npm run clima:real -- "Rio de Janeiro"
import { horaLocal } from "@/core/weather/hora-local"
import type { Cidade, Clima } from "@/core/weather/ports"
import { climaEmQualidades } from "@/core/weather/qualidades"
import { tendenciaDasProximasHoras } from "@/core/weather/tendencia"
import { getContainer } from "@/infra/container"

const USO = 'Uso: npm run clima:real -- "Nome da cidade"'

function linhaDaCidade(cidade: Cidade): string {
  const local = [cidade.regiao, cidade.pais].filter(Boolean).join(", ")
  return `Cidade: ${cidade.nome} (${local}) · fuso ${cidade.fuso}`
}

function imprimirClima(cidade: Cidade, clima: Clima, agora: Date): void {
  const qualidades = climaEmQualidades(clima)
  const tendencia = tendenciaDasProximasHoras(clima)
  const gunas = qualidades.gunas.length > 0 ? qualidades.gunas.join(", ") : "nenhuma"
  const temperatura = Math.round(clima.temperatura_aparente * 10) / 10

  console.log(linhaDaCidade(cidade))
  console.log(`Hora local: ${horaLocal(agora, cidade.fuso)}h`)
  console.log(`Temperatura aparente: ${temperatura} °C (${qualidades.faixa_temperatura})`)
  console.log(`Umidade: ${Math.round(clima.umidade)}% (${qualidades.faixa_umidade})`)
  console.log(`Gunas: ${gunas}`)
  console.log(
    `Próximas 6 horas: ${tendencia.temperatura}, chuva ${tendencia.chuva ? "sim" : "não"} (até ${tendencia.ate})`,
  )
}

async function main(): Promise<number> {
  const nome = process.argv[2]?.trim()
  if (!nome) {
    console.error(USO)
    return 2
  }

  const { cities, weather, clock } = getContainer()
  try {
    const [cidade] = await cities.buscar(nome)
    if (!cidade) {
      console.error(`Nenhuma cidade encontrada para "${nome}".`)
      return 1
    }
    const clima = await weather.buscar({ lat: cidade.lat, lon: cidade.lon })
    imprimirClima(cidade, clima, clock.now())
    return 0
  } catch (erro) {
    console.error(`Erro: ${erro instanceof Error ? erro.message : String(erro)}`)
    return 1
  }
}

void main().then((codigo) => {
  process.exitCode = codigo
})
