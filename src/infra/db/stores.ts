import type { Clock } from "@/core/clock"
import type { Stores } from "@/core/stores"
import { createPgAccounts } from "./accounts"
import { toDbError } from "./errors"
import type { Conexao } from "./mappers"
import { createPgPantry, type OpcoesPantry } from "./pantry"
import { createPgPreferences } from "./preferences"
import { createPgProfiles } from "./profiles"
import { createPgShortages } from "./shortages"

// Portas que ainda não têm adaptador Postgres (entram na T7).
const naoImplementado = async (): Promise<never> => {
  throw new Error("não implementado")
}

// Erro de conexão do driver vira RituError sem a URL; os demais passam sem mudança.
function protegerErros<T extends object>(porta: T): T {
  const protegida = Object.entries(porta).map(([nome, metodo]) => [
    nome,
    async (...args: unknown[]) => {
      try {
        return await (metodo as (...a: unknown[]) => unknown)(...args)
      } catch (erro) {
        throw toDbError(erro)
      }
    },
  ])
  return Object.fromEntries(protegida) as T
}

export function createPgStores(sql: Conexao, clock: Clock, opts: OpcoesPantry = {}): Stores {
  return {
    accounts: protegerErros(createPgAccounts(sql, clock)),
    profiles: protegerErros(createPgProfiles(sql, clock)),
    pantry: protegerErros(createPgPantry(sql, clock, opts)),
    preferences: protegerErros(createPgPreferences(sql, clock)),
    shortages: protegerErros(createPgShortages(sql, clock)),
    outcomes: {
      criar: naoImplementado,
      pendentes: naoImplementado,
      responder: naoImplementado,
      doRun: naoImplementado,
      apagarAguardandoAntesDe: naoImplementado,
    },
    routine: {
      notasAtivas: naoImplementado,
      anotar: naoImplementado,
      desativar: naoImplementado,
      resumo: naoImplementado,
      gravarResumo: naoImplementado,
    },
    patterns: {
      listar: naoImplementado,
      propor: naoImplementado,
      decidir: naoImplementado,
      apagar: naoImplementado,
    },
    messages: {
      gravar: naoImplementado,
      doDia: naoImplementado,
      marcarIncomodoDoRun: naoImplementado,
      apagarAntesDe: naoImplementado,
      apagarComIncomodoAntesDoDia: naoImplementado,
    },
    runs: {
      criar: naoImplementado,
      buscar: naoImplementado,
      aberto: naoImplementado,
      atualizar: naoImplementado,
      acrescentarEtapa: naoImplementado,
      etapas: naoImplementado,
      recentes: naoImplementado,
      contarMensagensDoDia: naoImplementado,
      votar: naoImplementado,
      expirarEmEsperaAntesDe: naoImplementado,
    },
    proposals: {
      criar: naoImplementado,
      doRun: naoImplementado,
      decidir: naoImplementado,
      recusadas: naoImplementado,
      expirarDosRuns: naoImplementado,
    },
  }
}
