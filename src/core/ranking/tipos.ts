import type { Funcao, Guna } from "@/core/knowledge/vocab"

// Tipos que o agente e o ranking dividem. Moram aqui para o ranking não importar de agents/.
export type EstadoNaCasa = "confirmado" | "incerto" | "ausente" // "sempre tenho" conta como confirmado
export type TipoDeSugestao = "cha" | "refeicao" | "oleo" | "pratica"

export type ItemDoCandidato = {
  alimento_id: string
  nome: string
  funcao?: Funcao
  casa: EstadoNaCasa
  contribui: Guna[]
  linha_base: string
}

export type Candidato = {
  tipo: TipoDeSugestao
  id: string // pratica_id, ou preparo_id quando tipo é "refeicao"
  nome: string
  itens: ItemDoCandidato[] // prática: os ingredientes; refeição: a 1ª opção de cada vaga obrigatória
  opcoes?: Partial<Record<Funcao, ItemDoCandidato[]>> // só refeição: até 3 por vaga, já ordenadas
  contribui: Guna[]
  linha_base: string
  adequacao: number
  nota: number
  gosta: boolean
  ajudou: number
  novidade: boolean
  no_fim: boolean
}

export type Sinais = {
  mensagens_hoje: number
  itens_confirmados_em_casa: number
  itens_incertos_em_casa: number
  registros_de_gosto: number
  registros_de_resultado: number
  retornos_pendentes: number
  tem_cidade: boolean
}

export type ParaTer = {
  alimento_id: string
  nome: string
  vezes: number
  contribui: Guna[]
  linha_base: string
}
