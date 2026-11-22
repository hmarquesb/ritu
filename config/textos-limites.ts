// Textos das telas de limite e da cota. Placeholders: {hora}, {n}.
export const textosLimites = {
  cota: {
    faixa:
      "Minha cota de IA de hoje acabou. Até por volta das {hora}, respondo com práticas da base: marque como você está nos atalhos.",
    rotulo: "Aviso",
  },
  restam: {
    varias: "Restam {n} mensagens hoje.",
    uma: "Resta 1 mensagem hoje.",
    variasDemo: "Restam {n} mensagens na demonstração.",
    umaDemo: "Resta 1 mensagem na demonstração.",
  },
  esgotadas: {
    conta: {
      titulo: "Suas mensagens de hoje acabaram",
      texto:
        "Amanhã tem mais. Os atalhos continuam: marque como você está e eu separo práticas da base.",
    },
    demo: {
      titulo: "Sua demonstração chegou ao fim das mensagens",
      texto:
        "Entre com Google para continuar com sua própria conta. Os atalhos continuam funcionando aqui.",
      google: "Entrar com Google",
    },
    ip: {
      titulo: "As mensagens desta conexão acabaram hoje",
      texto: "Muita gente usou o Ritu pela mesma rede. Amanhã tem mais; os atalhos continuam.",
    },
    textoGuardado: "O que você escreveu:",
  },
  atalhos: {
    enviar: "Ver práticas",
  },
  toques: {
    minuto: "Muitos toques seguidos. Espere um minuto e tente de novo.",
    dia: "Você chegou ao limite de toques de hoje. Amanhã tem mais.",
  },
} as const
