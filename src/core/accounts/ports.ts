import type { Prakriti } from "@/core/knowledge/adequacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"
import type { CidadeDaPessoa } from "@/core/weather/ports"
import type { Conta, Perfil } from "./types"

export interface AccountRepository {
  criar(dados: {
    tipo: "google" | "demo"
    google_sub?: string
    email?: string
    expira_em?: Date
  }): Promise<Conta>
  /** Conta vencida é tratada como inexistente. */
  buscar(contaId: string): Promise<Conta | undefined>
  /** Sem contaId. */
  buscarPorGoogleSub(sub: string): Promise<Conta | undefined>
  marcar(
    contaId: string,
    campos: Partial<
      Pick<
        Conta,
        "aviso_aceito_em" | "evitar_passo" | "evitar_lembrete_em" | "dosha_adiado_em" | "tester"
      >
    >,
  ): Promise<void>
  /** Cascata nas tabelas da conta e anonimiza os runs. */
  apagar(contaId: string): Promise<void>
  /** Sem contaId. */
  apagarDemosVencidas(): Promise<number>
}

/** Item da lista temporária do dia. "nao_come" guarda id de alimento da base; "nao_come_texto", o nome que a base não conhece. */
export type ItemTemporario =
  | EvitarItem
  | { tipo: "restricao"; valor: Restricao }
  | { tipo: "nao_come"; valor: string }
  | { tipo: "nao_come_texto"; valor: string }

export interface ProfileStore {
  /** Sem linha: perfil vazio. */
  ler(contaId: string): Promise<Perfil>
  definirPrakriti(
    contaId: string,
    prakriti: Prakriti | null,
    origem: "quiz" | "declarado" | null,
  ): Promise<void>
  /** Arredonda para 2 casas. */
  definirCidade(contaId: string, cidade: CidadeDaPessoa | null): Promise<void>
  definirRestricoes(contaId: string, restricoes: Restricao[]): Promise<void>
  definirNaoCome(
    contaId: string,
    itens: { tipo: "alimento" | "texto"; valor: string }[],
  ): Promise<void>
  /** Sem duplicar. */
  acrescentarEvitarSempre(contaId: string, itens: EvitarItem[]): Promise<void>
  removerEvitarSempre(contaId: string, item: EvitarItem, opts: { confirmado: true }): Promise<void>
  evitarTemporario(contaId: string, dia: string): Promise<ItemTemporario[]>
  /** Sem duplicar (tipo + valor). */
  acrescentarEvitarTemporario(contaId: string, dia: string, itens: ItemTemporario[]): Promise<void>
  /** Sem contaId. */
  apagarEvitarTemporarioAntesDe(dia: string): Promise<number>
}
