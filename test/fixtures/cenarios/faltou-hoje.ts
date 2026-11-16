import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Gengibre nunca registrado em casa: o chá com gengibre faltou; a pessoa diz que não tem e o gengibre vai para a lista.
export const faltouHoje: Cenario = {
  nome: "faltou-hoje",
  descricao:
    "Momento com frio, gengibre nunca registrado: pausa de casa, Não tenho, lista.propor do gengibre no chá, finalizar sem gengibre",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa.filter((item) => item.alimento_id !== "gengibre"),
  clima: frioAgitada.clima,
  mensagem: { texto: "estou com frio, o que tomo agora?", atalhos: [] },
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
  aprovacao: { aprovar: [1] },
  respostas: [
    {
      tipo: "casa",
      itens: [{ alimento_id: "gengibre", resposta: "nao_tenho" }],
    },
  ],
  roteiro: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou confirmar se tenho gengibre, que não aparece na casa.",
      chamadas: [{ nome: "ask_user", argumentos: { tipo: "casa", alimentos: ["gengibre"] } }],
    },
    {
      texto: "Vou propor pôr o gengibre na lista, já que faltou para o chá.",
      chamadas: [
        {
          nome: "lista.propor",
          argumentos: { alimento_id: "gengibre", pratica_id: "cha-gengibre" },
        },
      ],
    },
    {
      texto: "Vou montar a resposta com o que tenho, sem o chá.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Para este fim de tarde frio, uma refeição morna de arroz com abóbora assenta bem. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: ["frio"],
              qualidades_buscadas: ["quente"],
            },
            sugestoes: [
              {
                tipo: "refeicao",
                preparo_id: "arroz-com-legume",
                itens: [
                  {
                    alimento_id: "arroz-branco",
                    funcao: "base",
                    contribui: [],
                    linha_base: "alimentos:arroz-branco",
                  },
                  {
                    alimento_id: "abobora",
                    funcao: "legume",
                    contribui: [],
                    linha_base: "alimentos:abobora",
                  },
                ],
                motivo: "Uma comida morna e cozida, que assenta bem no frio.",
                linhas_base: ["preparos:arroz-com-legume"],
                novidade: false,
              },
            ],
            evitar: [],
            incertos: [],
            citados: [],
          },
        },
      ],
    },
  ],
}
