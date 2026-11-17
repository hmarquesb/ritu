import { type Roteiro, SEM_NADA } from "./tipos"

// A resposta traz marcação e tag literais: a tela precisa mostrá-las como texto puro.
export const roteiroTextoCru: Roteiro = {
  nome: "texto-cru",
  mensagem: "mostra um texto estranho",
  interpretacao: { ...SEM_NADA, intencoes: ["momento"], estados: ["com_frio"] },
  passos: [
    {
      texto: "Vou montar a resposta.",
      chamadas: [
        {
          nome: "finalizar",
          argumentos: {
            resposta:
              "Um chá morno ajuda no frio. <script>alert(1)</script> e **negrito** ficam como texto.",
            explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
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
                motivo: "Aquece o corpo, com o que você tem em casa.",
                linhas_base: ["praticas:cha-gengibre-canela"],
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
