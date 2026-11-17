import { createFakeWeather } from "@/infra/fakes/fake-weather"

// Clima fixo do modo e2e: frio e úmido no Rio, o mesmo do cenário frio-agitada.
export function createClimaFixo() {
  return createFakeWeather({ temperatura_aparente: 16, umidade: 88 })
}
