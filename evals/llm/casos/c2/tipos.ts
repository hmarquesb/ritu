import type { MensagemNoPrompt } from "@/core/agents/interpreter/entrada"
import type { Interpretacao } from "@/core/agents/interpreter/interpretacao"
import type { RespostaDaConversa } from "@/core/conversation/conversar"
import type { Estado } from "@/core/knowledge/vocab"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Caminho } from "@/core/runs/ports"
import type { CenarioDeConversa } from "../../../../test/fixtures/cenarios/tipos"
import type { BaseDoCaso } from "../../tipos"
import type { ResultadoDoRun } from "../c1/tipos"

// O que o Intérprete entrega ao caso: a interpretação já normalizada e o caminho que ela leva.
export type ExpectativaDoInterprete = {
  descricao: string
  confere: (r: { interpretacao: Interpretacao; caminho: Caminho }) => boolean
}

export type CasoInterprete = BaseDoCaso & {
  tipo: "interprete"
  mensagem: string
  atalhos?: Estado[]
  conversa?: MensagemNoPrompt[]
  pendentes?: { tipo: SugestaoRegistrada["tipo"]; titulo: string }[]
  deve: ExpectativaDoInterprete[]
  naoPode: ExpectativaDoInterprete[]
  falsoAlerta?: true
}

// O que a conversa entrega ao caso: a resposta da conversa, o resultado colhido do run e as pausas.
export type ExpectativaDaConversa = {
  descricao: string
  confere: (r: {
    resposta: RespostaDaConversa
    resultado: ResultadoDoRun
    // Cada pergunta que saiu num run pausado, com a resposta dada pelo runner.
    perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]
    // Etapas ask_user recusadas pelo código no run.
    recusadas: number
    // Chamadas de modelo antes da primeira pergunta (todas, sem pergunta).
    llmAntesDaPrimeiraPausa: number
    // Propostas da saída (vazio sem saída); o runner não aprova, então o caso termina no bloco.
    propostas: PropostaNaSaida[]
    // Chamadas de tool de proposta (memoria.propor, lista.propor) recusadas pelo código no run.
    propostasRecusadas: number
    // Títulos (sugestao.titulo) dos retornos de cenario.retornos que saíram de outcomes.pendentes no fim do caso.
    retornosFechados: string[]
    // Veredito do Juiz no run: tentativas lidas, se aprovou (null sem leitura) e os motivos apontados.
    juiz: { tentativas: number; aprovado: boolean | null; motivos: string[] }
  }) => boolean
}

export type CasoConversa = BaseDoCaso & {
  tipo: "conversa"
  // Cenário da conversa: como CenarioDoCaso, com mensagem obrigatória e sem entrada de acompanhante.
  cenario: Omit<CenarioDeConversa, "roteiro" | "respostas">
  // Respostas da pessoa às pausas, na ordem em que as perguntas saem; sem resposta sobrando, pular.
  // Uma posição pode ser função: recebe a pergunta que saiu e devolve a resposta (ex.: "Tenho a tudo").
  respostas?: (RespostaDaPessoa | ((p: Pergunta) => RespostaDaPessoa))[]
  // Só nos casos de pergunta: se o run devia perguntar (necessaria) ou não (desnecessaria).
  pergunta?: "necessaria" | "desnecessaria"
  // Só nos casos com proposta: se o run devia propor algo no bloco (esperada) ou não propor nada (nenhuma).
  proposta?: "esperada" | "nenhuma"
  // Família que o caso mede no relatório (D14, D22): Aprendizado, Para ter em casa, Memória, Segurança, Linguagem e sofrimento ou Incômodos. Sem família, o caso não entra nessas seções.
  familia?: "aprendizado" | "para_ter" | "memoria" | "seguranca" | "linguagem" | "incomodos"
  // Só nos casos de linguagem: a mensagem não devia gerar alerta; o relatório conta quando gerou.
  falsoAlerta?: true
  deve: ExpectativaDaConversa[]
  naoPode: ExpectativaDaConversa[]
}

export type CasoC2 = CasoInterprete | CasoConversa
