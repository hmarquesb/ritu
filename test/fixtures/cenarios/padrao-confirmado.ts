import type { SugestaoRegistrada } from "@/core/memory-schemas"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// O momento de frio e agitada do frio-agitada, sem o `para_ter` (que traria uma linha de lista no bloco).
export const roteiroDoMomento: PassoRoteirizado[] = [
  {
    texto: "Vou ver o clima de agora antes de sugerir.",
    chamadas: [{ nome: "clima.agora", argumentos: {} }],
  },
  {
    texto: "Vou conferir o que tenho em casa agora.",
    chamadas: [{ nome: "casa.ler", argumentos: {} }],
  },
  {
    texto: "Vou conferir se as combinações funcionam juntas.",
    chamadas: [
      {
        nome: "ayurveda.checar_combinacao",
        argumentos: { itens: ["abobora", "arroz-branco", "canela", "gengibre"] },
      },
    ],
  },
  {
    texto: "Vou montar a resposta com o que encontrei.",
    chamadas: [
      {
        nome: "finalizar",
        argumentos: {
          resposta:
            "Para este fim de tarde frio e úmido, um chá quente de gengibre com limão e mel e uma refeição morna de arroz com abóbora ajudam a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
          sugestoes: [
            {
              tipo: "cha",
              id: "cha-gengibre-limao-mel",
              motivo: "Aquece o corpo no fim do dia, com o que você tem em casa.",
            },
            {
              tipo: "refeicao",
              id: "arroz-com-legume",
              motivo: "Uma comida morna e cozida, que assenta bem no frio.",
            },
            {
              tipo: "pratica",
              id: "comer-sentada-sem-tela",
              motivo: "Comer com calma ajuda a sentir o corpo assentar.",
            },
          ],
          incertos: [],
        },
      },
    ],
  },
]

// A segunda mensagem sem estados (o jantar): legumes no vapor, como o `depois` de vegetariana (não repete o arroz da primeira resposta).
export const roteiroDoJantar = (id = "legumes-assados"): PassoRoteirizado[] => [
  {
    texto: "Vou montar o jantar com legumes.",
    chamadas: [
      {
        nome: "finalizar",
        argumentos: {
          resposta:
            "Para o jantar, legumes cozidos no vapor com abóbora ajudam a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
          sugestoes: [
            {
              tipo: "refeicao",
              id,
              motivo: "Legumes cozidos no vapor, para o jantar.",
            },
          ],
          incertos: [],
        },
      },
    ],
  },
]

// O chá de gengibre com canela (D3: a prática, com `pratica_id`), dito em 4 dias com frio e agitada: 3 "ajudou" e 1 "não ajudou".
const CHA: SugestaoRegistrada = {
  tipo: "cha",
  pratica_id: "cha-gengibre-canela",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre com canela",
}

export const historicoDoCha: NonNullable<Cenario["historico"]> = [
  { diasAtras: 10, estados: ["com_frio", "agitada"], sugestao: CHA, resultado: "ajudou" },
  { diasAtras: 8, estados: ["com_frio", "agitada"], sugestao: CHA, resultado: "nao_ajudou" },
  { diasAtras: 6, estados: ["com_frio", "agitada"], sugestao: CHA, resultado: "ajudou" },
  { diasAtras: 4, estados: ["com_frio", "agitada"], sugestao: CHA, resultado: "ajudou" },
  // Dias só com um dos estados (D4): sem sugestão, o junto fica em 4 de 6 (67%), abaixo de 75%.
  { diasAtras: 9, estados: ["com_frio"] },
  { diasAtras: 7, estados: ["com_frio"] },
  { diasAtras: 5, estados: ["agitada"] },
  { diasAtras: 3, estados: ["agitada"] },
]

// Padrão confirmado: o chá com frio e agitada, a pessoa aprova a linha e a segunda mensagem leva a frase.
export const padraoConfirmado: Cenario = {
  nome: "padrao-confirmado",
  descricao:
    "Chá de gengibre com canela ajudou em 3 de 4 dias com frio e agitada: detectado, proposto no bloco, aprovado e levado ao contexto",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  historico: historicoDoCha,
  detectar: true,
  mensagem: { texto: "Estou com frio e agitada depois do trabalho.", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: roteiroDoMomento,
  depois: {
    mensagem: { texto: "e no jantar?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
    roteiro: roteiroDoJantar(),
  },
}
