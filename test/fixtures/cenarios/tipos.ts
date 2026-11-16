import type { Papel } from "@config/llm-cotas"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { Restricao } from "@/core/knowledge/vocab"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { MensagemRecebida } from "@/core/messages/texto"
import type { ItemTipo } from "@/core/preferences/ports"
import type { RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Caminho } from "@/core/runs/ports"
import type { CidadeDaPessoa, Clima } from "@/core/weather/ports"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

// Cenário de demonstração: perfil, casa, faltas, clima e roteiro de um momento; com `mensagem`, passa pela conversa.
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
  // Sem `entrada` e sem `mensagem`, montarCenario lança erro (D16).
  entrada?: EntradaDoAcompanhante
  // Mensagem que a pessoa manda pela conversa (`conversar`).
  mensagem?: MensagemRecebida
  // Resposta roteirizada do Intérprete (createFakeLlm); sem ela, o Intérprete não tem resposta.
  interpretacao?: SaidaDoInterprete
  // Retornos aguardando; `diasAtras` diz quando o run foi criado.
  retornos?: { sugestao: SugestaoRegistrada; diasAtras: number }[]
  // Mensagens de conversas anteriores, cada uma num run já encerrado com o caminho dado.
  mensagens?: { autor: "pessoa" | "agente"; texto: string; caminho?: Caminho }[]
  // Respostas da pessoa às pausas, na ordem em que as perguntas saem (rodarCenario).
  respostas?: RespostaDaPessoa[]
  // Decisão do bloco de aprovação: posições das linhas (a partir de 1), ou "agora_nao" (nada). Sem ela, o bloco fica aberto.
  aprovacao?: { aprovar: number[] } | "agora_nao"
  // Segunda mensagem da mesma conversa, depois do bloco (D16).
  depois?: {
    mensagem: MensagemRecebida
    interpretacao: SaidaDoInterprete
    roteiro: PassoRoteirizado[]
  }
  roteiro: PassoRoteirizado[]
}

// Tipos estreitos: os registros de index.ts os usam para que `entrada` (007) e `mensagem` (conversa) não sejam opcionais.
export type CenarioComEntrada = Cenario & { entrada: EntradaDoAcompanhante }
export type CenarioDeConversa = Cenario & { mensagem: MensagemRecebida }
