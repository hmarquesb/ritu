// O pooler do Neon (PgBouncer em modo transação) não aceita prepared statements.
export function opcoesDoPostgres(url: string): { prepare?: false } {
  try {
    return new URL(url).hostname.includes("-pooler.") ? { prepare: false } : {}
  } catch {
    return {}
  }
}
