// Checagem antes do 1º caso de um eval com LLM: o Postgres responde e cada chave do Gemini configurada responde.
// Para na primeira falha, sem criar andamento. Quem chama injeta o banco e as chaves; a regra fica aqui.

export type ChecagemPrevia = {
  banco: () => Promise<void>
  chaves: { variavel: string; listar: () => Promise<void> }[]
}

export type ResultadoDaChecagem = { ok: true } | { ok: false; mensagem: string }

const MENSAGEM_DO_BANCO = "Postgres não respondeu (docker compose up -d)"

/** Não repete o erro bruto: ele pode trazer a URL do banco. */
export async function checarAntes(c: ChecagemPrevia): Promise<ResultadoDaChecagem> {
  try {
    await c.banco()
  } catch {
    return { ok: false, mensagem: MENSAGEM_DO_BANCO }
  }
  for (const chave of c.chaves) {
    try {
      await chave.listar()
    } catch {
      return { ok: false, mensagem: `${chave.variavel} não respondeu à listagem de modelos` }
    }
  }
  return { ok: true }
}
