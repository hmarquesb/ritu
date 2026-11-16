import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Primeira entrega, com a promessa que o Juiz aponta; a nova tentativa entrega o conforto.
export const RESPOSTA_COM_PROMESSA =
  "Um chá quente de gengibre com canela resolve a dor no estômago e aquece o corpo. Se puder, sente-se para beber, sem pressa."
export const RESPOSTA_DE_CONFORTO =
  "Um chá quente de gengibre com canela pode aquecer o corpo neste fim de tarde. Se puder, sente-se para beber, sem pressa e sem tela."

export const passoDoClima: PassoRoteirizado = {
  texto: "Vou ver o clima de agora antes de sugerir.",
  chamadas: [{ nome: "clima.agora", argumentos: {} }],
}

// Uma entrega com o mesmo chá e o mesmo momento; só o texto da resposta muda.
export function entregaDoCha(resposta: string): PassoRoteirizado {
  return {
    texto: "Vou montar a resposta com o que encontrei.",
    chamadas: [
      {
        nome: "finalizar",
        argumentos: {
          resposta,
          explicacao: {
            qualidades_do_momento: ["pesado", "frio"],
            qualidades_buscadas: ["quente"],
          },
          sugestoes: [
            {
              tipo: "cha",
              pratica_id: "cha-gengibre-canela",
              itens: [
                {
                  alimento_id: "gengibre",
                  contribui: ["quente"],
                  linha_base: "alimentos:gengibre",
                },
                {
                  alimento_id: "canela",
                  contribui: ["quente"],
                  linha_base: "alimentos:canela",
                },
              ],
              motivo: "Aquece o corpo no fim do dia, com o que você tem em casa.",
              linhas_base: ["praticas:cha-gengibre-canela"],
              novidade: false,
            },
          ],
          evitar: ["incomodos:estomago-pesado/unica"],
          incertos: [],
          citados: [],
        },
      },
    ],
  }
}

// Momento com estômago pesado e frio (incômodo leve, sem variante); o Juiz reprova a primeira entrega por promessa.
export const juizCorrige: Cenario = {
  nome: "juiz-corrige",
  descricao:
    "Momento com estômago pesado e frio; a primeira entrega promete que o chá resolve a dor, o Juiz reprova por promessa, a nova tentativa no papel reforco entrega em linguagem de conforto e o Juiz aprova",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "tô com o estômago pesado e com frio, o que tomo agora?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio"],
    incomodo: { id: "estomago-pesado" },
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  juiz: [{ apontamentos: [{ motivo: "promessa", trecho: "resolve a dor" }] }],
  roteiro: [passoDoClima, entregaDoCha(RESPOSTA_COM_PROMESSA), entregaDoCha(RESPOSTA_DE_CONFORTO)],
}
