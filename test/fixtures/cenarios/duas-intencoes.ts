import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Duas intenções (casa e momento): vai ao Acompanhante, que lê a casa e usa a abóbora que acabou de chegar.
export const duasIntencoes: Cenario = {
  nome: "duas-intencoes",
  descricao:
    "Comprou abóbora e pergunta o que fazer hoje, sem abóbora na casa antes: Acompanhante com casa e momento, roteiro casa.ler → finalizar",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa.filter((item) => item.alimento_id !== "abobora"),
  clima: frioAgitada.clima,
  mensagem: { texto: "comprei abóbora, o que faço com ela hoje?", atalhos: [] },
  interpretacao: {
    intencoes: ["casa", "momento"],
    estados: [],
    itens_casa: [{ nome: "abóbora", acao: "tem" }],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [
    {
      texto: "Vou conferir o que tenho em casa agora.",
      chamadas: [{ nome: "casa.ler", argumentos: {} }],
    },
    {
      texto: "Vou montar a resposta com a abóbora que chegou.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Com a abóbora que você trouxe, uma refeição morna de arroz com abóbora cai bem hoje. Se puder, sente-se para comer, sem tela.",
            explicacao: {
              qualidades_do_momento: [],
              qualidades_buscadas: [],
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
                motivo: "Uma comida morna e cozida, com a abóbora que você acabou de trazer.",
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
