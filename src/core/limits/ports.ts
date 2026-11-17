export type Janela = "minuto" | "dia"

export interface UsageLimiter {
  // Soma 1 em todas as chaves, ou em nenhuma: se alguma já está no teto, devolve a primeira que barrou.
  // `inicio` próprio da chave vale no lugar do da chamada.
  consumir(
    pedidos: { chave: string; teto: number; inicio?: string }[],
    janela: Janela,
    inicio: string,
  ): Promise<{ ok: true } | { ok: false; chave: string }>
  usado(chave: string, janela: Janela, inicio: string): Promise<number>
  // Linhas "dia" com início menor e linhas "minuto" de dias anteriores (pelo dia, os 10 primeiros caracteres).
  apagarAntesDe(inicio: string): Promise<number>
}
