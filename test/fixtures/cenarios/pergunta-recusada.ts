import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// O agente tenta perguntar sobre a abóbora, que já está confirmada em casa: a pergunta é recusada e nada sai à pessoa.
export const perguntaRecusada: Cenario = {
  nome: "pergunta-recusada",
  descricao:
    "Abóbora já confirmada em casa: ask_user recusado (ja_confirmado), sem pausa, finalizar com a abóbora",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: [{ alimento_id: "abobora" }],
  clima: frioAgitada.clima,
  mensagem: { texto: "estou com frio, o que como no jantar?", atalhos: [] },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [
    {
      texto: "Vou confirmar a abóbora com a pessoa.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["abobora"] } }],
    },
    {
      texto: "Vou montar a resposta com a abóbora que já está em casa.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para um jantar frio, uma refeição morna de abóbora cozida no vapor ajuda a aquecer sem pesar. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente"],
            },
            sugestoes: [
              {
                tipo: "refeicao",
                preparo_id: "legumes-no-vapor",
                itens: [
                  {
                    alimento_id: "abobora",
                    funcao: "legume",
                    contribui: [],
                    linha_base: "alimentos:abobora",
                  },
                ],
                motivo: "Uma comida morna e cozida, com a abóbora que já está em casa.",
                linhas_base: ["preparos:legumes-no-vapor"],
                novidade: false,
              },
            ],
            evitar: ["estados:com_frio"],
            incertos: [],
            citados: [],
          },
        },
      ],
    },
  ],
}
