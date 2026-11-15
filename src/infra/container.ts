import { type AppConfig, config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { loadKnowledgeBase, readDadosDaBase } from "@/infra/knowledge/yaml-knowledge"
import { systemClock } from "@/infra/system-clock"

export type Container = { config: AppConfig; clock: Clock; knowledge: KnowledgeBase }

// Leitura crua de data/ para scripts (sem validar): o script valida com validarBase.
export function readKnowledgeData(dir?: string): DadosDaBase {
  return readDadosDaBase(dir)
}

export function createContainer(overrides?: Partial<Container>): Container {
  let knowledge: KnowledgeBase | undefined
  return {
    config,
    clock: systemClock,
    // Carregada na primeira leitura e guardada: importar ou criar o container não toca em data/.
    get knowledge() {
      knowledge ??= loadKnowledgeBase()
      return knowledge
    },
    ...overrides,
  }
}

let instance: Container | undefined

export function getContainer(): Container {
  instance ??= createContainer()
  return instance
}
