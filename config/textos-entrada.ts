// Textos da entrada, dos avisos, do "Antes de começar", de "evitar", do dosha, da cidade e do quiz.
// Placeholders {n} e {nome} ficam no texto; quem usa substitui.
export const textosEntrada = {
  entrada: {
    titulo: "Entrar",
    subtitulo: "Que bom ter você aqui",
    oQueE:
      "Um agente ayurvédico para o seu momento. Conte como você está e o que tem em casa, e receba um chá, uma refeição simples ou uma prática para agora.",
    aviso: "Projeto de estudo. Não é orientação médica.",
    demo: "Testar com perfil de demonstração",
    demoApoio: "Sem cadastro. Você entra com um perfil pronto, que expira em 24 horas.",
    google: "Entrar com Google",
    googleApoio: "Seu perfil e sua memória ficam salvos. O e-mail serve só para entrar.",
  },
  aviso: {
    demo_limite_ip: "Você já abriu 5 demonstrações hoje. Entre com Google ou volte amanhã.",
    demo_limite_global: "As demonstrações de hoje acabaram. Entre com Google ou volte amanhã.",
    demo_expirou: "Sua demonstração expirou. Você pode abrir outra.",
    erro_google: "Não consegui entrar com o Google agora. Tente de novo.",
    dados_apagados: "Seus dados foram apagados.",
  },
  avisoInicial: {
    titulo: "Antes de começar",
    saude: {
      forte: "Não é orientação médica.",
      resto:
        "O Ritu sugere conforto com alimentos, ervas de cozinha, óleos comuns e práticas leves. Ele não diagnostica, não trata e não substitui um profissional de saúde.",
    },
    ia: {
      forte: "Suas mensagens passam por um serviço de IA.",
      resto:
        "O Ritu usa o Gemini, do Google, no plano gratuito. Nesse plano, o Google pode usar as mensagens para melhorar os produtos dele. Não escreva o que você não quer compartilhar.",
    },
    memoria: {
      forte: "Você vê e apaga o que o Ritu guarda.",
      resto:
        'Tudo o que ele anota aparece em "O que sei sobre você", e você pode apagar seus dados quando quiser.',
    },
    demo: "Esta demonstração expira em 24 horas e depois é apagada.",
    botao: "Entendi, quero começar",
  },
  evitar: {
    titulo: "Tem algum alimento que você nunca pode comer?",
    apoio:
      "O Ritu nunca vai sugerir o que estiver aqui, nem em chá, refeição ou óleo. Não precisa dizer o motivo.",
    botoes: { pronto: "Pronto", nenhum: "Nenhum", pular: "Pular" },
  },
  dosha: {
    titulo: "Quer descobrir seu dosha?",
    apoio:
      "Dosha é o seu jeito de base, na Ayurveda. Com ele, o Ritu acerta mais. Sem ele, responde com o seu momento e o clima.",
    opcoes: { quiz: "Fazer o quiz", sei: "Já sei meu dosha", adiar: "Agora não" },
  },
  cidade: {
    titulo: "Em que cidade você está?",
    apoio:
      "O Ritu olha o clima da sua cidade na hora de sugerir. Ele nunca usa a localização do aparelho. Você pode pular.",
  },
  quiz: {
    progresso: "Pergunta {n} de 8",
    resultado: "Seu dosha é {nome}",
  },
  componentes: {
    buscaMinima: "Digite {n} letras ou mais",
    erroSalvar:
      "Não consegui salvar agora. Suas escolhas continuam aqui; toque de novo para tentar.",
    evitar: {
      grupos: "Grupos de alimentos",
      buscar: "Buscar um alimento",
      nenhumAlimento: "Nenhum alimento encontrado",
      outro: "Outro alimento",
      adicionar: "Adicionar",
      escolhidos: "Escolhidos ({n} de {max})",
      nadaEscolhido: "Nada escolhido ainda.",
    },
    cidade: {
      buscar: "Buscar cidade",
      nenhuma: "Nenhuma cidade encontrada",
      indisponivel: "Não consegui buscar a cidade agora. Você pode seguir sem ela.",
      pular: "Pular a cidade",
    },
    quiz: {
      erro: "Não consegui calcular agora. Suas respostas continuam aqui; toque de novo para tentar.",
      voltar: "Voltar",
      proxima: "Próxima",
      verResultado: "Ver resultado",
      continuar: "Continuar",
    },
  },
  faixa: {
    botao: "Criar meu perfil",
  },
  conversa: {
    vazia: "A conversa começa aqui.",
  },
} as const
