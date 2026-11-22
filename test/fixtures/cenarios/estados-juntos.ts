import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Momento de pesada: o que pede leveza e calor (o chá), sem o arroz, que é pesado.
const roteiroDaPesada: PassoRoteirizado[] = [
  {
    texto: "Vou ver o clima de agora antes de sugerir.",
    chamadas: [{ nome: "clima.agora", argumentos: {} }],
  },
  {
    texto: "Vou montar a resposta para quem está pesada.",
    chamadas: [
      {
        nome: "finalizar",
        argumentos: {
          resposta:
            "Para agora, um chá quente de gengibre com limão e mel ajuda a sentir o corpo mais leve. Se puder, sente-se para comer, sem tela.",
          sugestoes: [
            {
              tipo: "cha",
              id: "cha-gengibre-limao-mel",
              motivo: "Aquece e ajuda a digestão quando o corpo está pesado.",
            },
          ],
          incertos: [],
        },
      },
    ],
  },
]

// Pesada em 4 dias, 3 deles com sem energia no mesmo run; 1 dia só com sem energia (D4: 3 de 4 nos dois sentidos, empate que fica com pesada antes em ESTADOS).
export const estadosJuntos: Cenario = {
  nome: "estados-juntos",
  descricao:
    "Pesada em 4 dias, 3 com sem energia no mesmo run: o par vira padrão candidato e a linha vai no bloco, que fica aberto",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  historico: [
    { diasAtras: 10, estados: ["pesada", "sem_energia"] },
    { diasAtras: 7, estados: ["pesada", "sem_energia"] },
    { diasAtras: 4, estados: ["pesada", "sem_energia"] },
    { diasAtras: 6, estados: ["pesada"] },
    { diasAtras: 2, estados: ["sem_energia"] },
  ],
  detectar: true,
  mensagem: { texto: "Estou pesada hoje.", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["pesada"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: roteiroDaPesada,
}
