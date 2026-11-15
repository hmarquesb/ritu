import type { Papel } from "@config/llm-cotas"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"
import type { ItemTipo } from "@/core/preferences/ports"
import type { CidadeDaPessoa, Clima } from "@/core/weather/ports"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

// Cenário de demonstração do Acompanhante: perfil, casa, faltas, clima e roteiro de um momento.
export type Cenario = {
  nome: string
  descricao: string
  agora: string
  perfil: {
    prakriti?: Prakriti
    cidade?: CidadeDaPessoa
    evitar_sempre?: EvitarItem[]
    restricoes?: Restricao[]
  }
  casa: { alimento_id: string; diasDesdeConfirmacao?: number; sempre_tenho?: boolean }[]
  preferencias?: {
    tipo: ItemTipo
    id: string
    gosto?: "gosta" | "nao_gosta"
    ajudou?: number
    nao_ajudou?: number
    ultimos_resultados?: string[]
  }[]
  faltas?: { alimento_id: string; diasAtras: number }[]
  clima?: Partial<Clima> | "fora_do_ar"
  // Papel com todos os modelos esgotados no dia: o roteador não acha vaga e a resposta sai sem modelo.
  esgotado?: Papel
  entrada: EntradaDoAcompanhante
  roteiro: PassoRoteirizado[]
}
