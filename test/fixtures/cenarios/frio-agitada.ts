import type { Cenario } from "./tipos"

export const frioAgitada: Cenario = {
  nome: "frio-agitada",
  descricao:
    "Momento com texto, Vata-Pitta, Rio com frio e úmido, casa com abóbora, arroz, ghee, gengibre, canela, limão e mel, cardamomo com falta em 3 dias",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: {
    prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
    cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
  },
  casa: [
    { alimento_id: "abobora" },
    { alimento_id: "arroz-branco" },
    { alimento_id: "ghee" },
    { alimento_id: "gengibre" },
    { alimento_id: "canela" },
    { alimento_id: "limao" },
    { alimento_id: "mel" },
  ],
  faltas: [
    { alimento_id: "cardamomo", diasAtras: 1 },
    { alimento_id: "cardamomo", diasAtras: 2 },
    { alimento_id: "cardamomo", diasAtras: 3 },
  ],
  clima: { temperatura_aparente: 16, umidade: 88 },
  entrada: {
    texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    evitar_da_mensagem: [],
  },
  roteiro: [
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
            para_ter: true,
          },
        },
      ],
    },
  ],
}

// O mesmo roteiro sem `para_ter`: a conversa pela mensagem não traz as faltas do cenário.
export const roteiroSemParaTer = frioAgitada.roteiro.map((passo) => ({
  ...passo,
  chamadas: passo.chamadas?.map((chamada) => {
    if (chamada.nome !== "finalizar") return chamada
    const { para_ter: _, ...resto } = chamada.argumentos as Record<string, unknown>
    return { ...chamada, argumentos: resto }
  }),
}))
