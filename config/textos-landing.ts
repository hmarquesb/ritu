// Textos da landing (página pública sem conta). Itens separados por " · " são arrays; "\n\n" separa parágrafos.
// {nome} fica no texto de rodapé.
export const textosLanding = {
  conheca: "Conheça o Ritu",
  como: {
    titulo: "Como funciona",
    1: {
      titulo: "Conte como você está",
      texto:
        'Do seu jeito: "acordei com frio e agitada", "comi demais no almoço", "fui à feira e trouxe abóbora".',
    },
    2: {
      titulo: "O Ritu junta o que importa",
      texto:
        "Seu dosha, o clima de agora na sua cidade, o que você tem em casa e o que já funcionou para você.",
    },
    3: {
      titulo: "Você recebe o que fazer agora",
      texto:
        "Um chá, uma refeição simples, um óleo ou uma prática, com o porquê em poucas palavras.",
    },
  },
  exemplo: {
    titulo: "Uma conversa de exemplo",
    nota: "Do perfil de demonstração: Vata-Pitta, no Rio, com gengibre, canela, abóbora e arroz em casa.",
    pessoa: "acordei com frio e agitada, o que eu como?",
    agente:
      "Frio e agitação pedem o contrário: calor, peso e calma.\n\nPara agora, um chá de gengibre com canela, morno, tomado devagar. No café, um mingau de arroz com abóbora e uma pitada de canela: quente, macio e levemente doce, ele assenta sem pesar.\n\nSe der, antes de começar o dia, cinco minutos de respiração lenta.",
    aviso: "Não é orientação médica.",
  },
  faz: {
    titulo: "O que ele faz",
    itens: [
      "Explica o porquê de cada sugestão.",
      "Troca um ingrediente que você não tem ou não gosta.",
      "Lembra do que funcionou e do que você não come.",
      "Avisa o que vale ter em casa para as próximas vezes.",
      "Só anota algo sobre você com a sua aprovação.",
    ],
  },
  naoFaz: {
    titulo: "O que ele não faz",
    itens: [
      "Não orienta sobre doença, gestação ou remédio.",
      "Não usa a localização do seu aparelho: o clima vem da cidade que você escolhe.",
      "Não manda notificações nem e-mails.",
      "Não indica marca, loja nem preço.",
    ],
  },
  dentro: {
    titulo: "Por dentro",
    texto:
      "O Ritu é um projeto de estudo de agentes de IA. Cada resposta consulta uma base ayurvédica com fontes, confere o próprio trabalho e passa por um juiz antes de chegar a você. Tudo isso é medido, e os números são públicos.",
    bastidores: "Ver os bastidores",
    mcp: "Usar a base no seu agente (MCP)",
    codigo: "Ver o código no GitHub",
  },
  final: {
    titulo: "Quer ver com os seus olhos?",
    texto: "A demonstração já vem com casa, gostos e conversa. Sem cadastro, em dois toques.",
  },
  rodape: {
    sobre: "Sobre e privacidade",
    bastidores: "Bastidores",
    codigo: "Código no GitHub",
    assinatura: "Projeto de estudo de {nome}. Não é orientação médica.",
  },
  novaAba: "(abre em nova aba)",
} as const

// Conversa de exemplo da landing: ids da base (data/). Sem menu, sem verbos e sem avaliação (BlocoDeSugestao exemplo).
export const exemploDaLanding = {
  sugestoes: [
    { tipo: "pratica", id: "cha-gengibre-canela" },
    { tipo: "preparo", id: "mingau", ingredientes: ["arroz-branco", "abobora", "canela"] },
    { tipo: "pratica", id: "respiracao-lenta" },
  ],
} as const
