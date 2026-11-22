import type { Papel } from "../../../config/llm-cotas"
import type { FamiliaMarcada, Marca, TipoDeCaso } from "../../../evals/llm/tipos"
import type { SaidaDoAcompanhante } from "../../../src/core/agents/companion/saida"
import type { CodigoDeViolacao } from "../../../src/core/agents/companion/validador"
import type { MotivoDoJuiz } from "../../../src/core/agents/judge/saida"
import { LlmError } from "../../../src/core/llm/errors"
import type { Caminho } from "../../../src/core/runs/ports"

export type UsoDoPapel = { chamadas: number; tokens_entrada: number; tokens_saida: number }

/** `null`: checagem não avaliada. */
export type Checagem = {
  lista: "deve" | "nao_pode" | "criterio"
  descricao: string
  ok: boolean | null
}

export type EstadoDoCaso = "acertou" | "falhou" | "inconclusivo"

/** Por que o caso não tem resposta conclusiva: o run não chegou a decidir, ou a cota, o banco ou o Juiz faltaram. */
export type MotivoInconclusivo =
  | "banco"
  | "sem_etapas"
  | "cota"
  | "juiz_indisponivel"
  | "timeout_sem_decisao"

export type ResultadoDoCaso = {
  id: string
  titulo: string
  tipo: TipoDeCaso
  familias: FamiliaMarcada[]
  marcas: Marca[]
  checagens: Checagem[]
  /** Sem erro e nenhuma checagem `false`. `true` só com `estado` `acertou`. */
  acertou: boolean
  estado: EstadoDoCaso
  /** Só com `estado` `inconclusivo`. */
  inconclusivo?: MotivoInconclusivo
  /** Tipos `acompanhante` e `conversa`. */
  run?: {
    origem: SaidaDoAcompanhante["origem"]
    caminho?: Caminho
    /** `null`: caso sem `trajetoria`. */
    trajetoriaOk: boolean | null
    /** Chamadas proibidas mais as repetidas. */
    chamadasDesnecessarias: number
    /** Chamadas dos papéis `decisao` e `reforco`. */
    passos: number
    validacoes: ("ok" | "recusado" | "falhou")[]
    violacoesDa1a: CodigoDeViolacao[]
    perguntasFeitas: number
    perguntasRecusadas: number
    propostasRecusadas: number
    juizAprovado: boolean | null
  }
  avaliacao?: {
    explicacao: (boolean | null)[]
    textoBate: boolean | null
    motivos: (boolean | null)[]
  }
  /** Tipo `juiz`. */
  juiz?: { esperados: MotivoDoJuiz[]; devolvidos: MotivoDoJuiz[]; aprovado: boolean }
  uso: Partial<Record<Papel, UsoDoPapel>>
  trocas: number
  latenciaMs: number
  modelos: string[]
  /** Fora de `uso`: o avaliador usa o papel `apoio` à parte. */
  usoDoAvaliador?: UsoDoPapel
  /** Classe ou código; o caso conta como errado. */
  erro?: string
}

/** O que o runner colhe de um caso para avaliar e para o arquivo de falhas local. Nunca vai para arquivo versionado. */
export type Colhido = {
  mensagem?: string
  texto: string
  saida?: SaidaDoAcompanhante
  etapas: { tipo: string; nome: string; status: string; resumo: string | null }[]
}

export function calcularAcertou(r: Pick<ResultadoDoCaso, "checagens" | "erro">): boolean {
  if (r.erro !== undefined) return false
  return r.checagens.every((checagem) => checagem.ok !== false)
}

export function codigoDoErro(e: unknown): string {
  if (e instanceof LlmError) return `LlmError:${e.code}`
  if (e instanceof Error) return e.constructor.name
  return "desconhecido"
}
