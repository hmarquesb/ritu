export type ItemDaCasa = {
  id: string
  conta_id: string
  alimento_id: string | null
  nome_livre: string | null
  nome_normalizado: string | null
  estado: "tem" | "acabou"
  sempre_tenho: boolean
  confirmado_em: string
  origem: "conversa" | "tela" | "pergunta"
}
