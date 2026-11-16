import { frioAgitada } from "./frio-agitada"
import { roteiroDoJantar } from "./padrao-confirmado"
import type { Cenario } from "./tipos"

// Rotina dita de passagem: o Intérprete acha o fato, o run chama memoria.propor, a pessoa aprova e o resumo muda.
export const rotinaResumida: Cenario = {
  nome: "rotina-resumida",
  descricao:
    "Duas notas de rotina (almoço fora e acordar às 5 h); a mensagem diz que voltou a almoçar em casa: linha da rotina aprovada, resumo novo, segunda mensagem com o resumo",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  rotina: [
    { texto: "você almoça fora durante a semana", diasAtras: 12 },
    { texto: "você acorda às 5 h às terças", diasAtras: 5 },
  ],
  memoria: {
    resumo: "Você voltou a almoçar em casa todo dia. Você acorda às 5 h às terças.",
  },
  mensagem: {
    texto: "voltei a almoçar em casa todo dia, o que faço hoje?",
    atalhos: [],
  },
  interpretacao: {
    intencoes: ["vida"],
    estados: [],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    fato_de_rotina: "você voltou a almoçar em casa todo dia",
    suspeito: false,
  },
  aprovacao: { aprovar: [1] },
  roteiro: [
    {
      texto: "Vou anotar a rotina, se a pessoa quiser guardar.",
      chamadas: [{ nome: "memoria.propor", argumentos: { tipo: "rotina" } }],
    },
    {
      texto: "Vou responder com o que ouvi.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com o almoço em casa de volta, vale deixar à mão o que você já tem. Se puder, sente-se para comer, sem tela.",
            explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
            sugestoes: [],
            evitar: [],
            incertos: [],
            citados: [],
          },
        },
      ],
    },
  ],
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
    roteiro: roteiroDoJantar,
  },
}
