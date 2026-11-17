export type Janela = "minuto" | "dia"

export interface UsageLimiter {
  // Soma 1 em todas as chaves, ou em nenhuma: se alguma já está no teto, devolve a primeira que barrou.
  consumir(
    pedidos: { chave: string; teto: number }[],
    janela: Janela,
    inicio: string,
  ): Promise<{ ok: true } | { ok: false; chave: string }>
  usado(chave: string, janela: Janela, inicio: string): Promise<number>
  // Linhas da janela "dia" com início menor.
  apagarAntesDe(inicio: string): Promise<number>
}
