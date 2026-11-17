// Textos da tela de conversa. Placeholders {n}, {m}, {item}, {itens} e {linha} ficam no texto; quem usa substitui com `formatar`.
export const textosConversa = {
  caixa: {
    rotulo: "Sua mensagem",
    apoio: "Conte como você está agora ou pergunte algo.",
    atalhos: "Como você está?",
    enviar: "Enviar",
    respondendo: "O Ritu está respondendo",
    vazia: "Escreva algo ou marque como você está.",
    longa: "{n} de 1000 caracteres",
  },
  etapas: {
    ainda: "O Ritu ainda está respondendo…",
    passos: "Pensei em {n} passos",
    passo: "Pensei em 1 passo",
    comoPensei: "Como pensei",
    entendendo: "Entendendo sua mensagem…",
    cuidado: "Lendo com cuidado…",
    clima: "Vendo o clima…",
    casa: "Olhando sua casa…",
    lembrando: "Lembrando do que você me contou…",
    base: "Consultando a base ayurvédica…",
    retorno: "Anotando o seu retorno…",
    conferindo: "Conferindo a resposta…",
    revisando: "Revisando com cuidado…",
    memoria: "Atualizando o que sei da sua rotina…",
  },
  pergunta: {
    pular: "Pular",
    responder: "Responder",
    seguiu: "Você seguiu a conversa.",
    expirou: "Esta pergunta expirou. Pode me contar de novo.",
    opcoesCasa: "Tenho · Não tenho · Não gosto",
    opcoesCome: "Como · Não como",
  },
  sugestao: {
    porque: "Por quê?",
    novidade: "Novidade",
    incerto: "confira se ainda tem",
    menu: "Opções para {item}",
    menuItens: "Trocar · Não tenho · Não gosto",
    trocaPergunta: "Você tem {item}?",
    trocaOpcoes: "Tenho · Não tenho",
  },
  evitar: {
    rotulo: "Evite agora: {itens}.",
  },
  paraTer: {
    rotulo: "Vale ter em casa: {item}",
    vezes: "fez falta {n} vezes nos últimos 30 dias",
  },
  bloco: {
    titulo: "Posso anotar isto?",
    anotar: "Anotar",
    agoraNao: "Agora não",
    anotei: "Anotei {n} de {m}.",
    nada: "Tudo bem, não anotei nada.",
    seguiu: "Ficou para depois. Nada foi anotado.",
    expirou: "Esta proposta expirou. Nada foi anotado.",
    linha: "Anotar: {linha}",
  },
  rodape: {
    aviso: "Não é orientação médica.",
    gostei: "Gostei da resposta",
    naoGostei: "Não gostei da resposta",
  },
  geral: "Resposta geral. Descubra seu dosha para eu acertar mais.",
  retornos: {
    um: "1 sugestão esperando seu retorno",
    varios: "{n} sugestões esperando seu retorno",
  },
  vazia: {
    titulo: "Como você está agora?",
    texto: "Pode contar do jeito que vier, ou tocar num dos atalhos.",
  },
  erro: {
    run_aberto: "Ainda estou respondendo a sua última mensagem.",
    pergunta_expirada: "Esta pergunta expirou. Pode me contar de novo.",
    aprovacao_expirada: "Esta proposta expirou. Nada foi anotado.",
    rede: "Não consegui falar com o Ritu agora. Sua mensagem continua aqui.",
    inesperado: "Algo deu errado do meu lado. Tente de novo.",
    tentar: "Tentar de novo",
  },
  abas: {
    conversa: "Conversa",
    casa: "Minha casa",
    comoFicou: "Como ficou?",
    voce: "Você",
    rotulo: "Navegação principal",
  },
  emBreve: "Esta parte chega em breve.",
  semJs: "A conversa precisa de JavaScript para funcionar.",
  comoPensei: {
    titulo: "Como pensei",
  },
} as const

// Troca cada {chave} pelo valor correspondente; chave ausente fica literal.
export function formatar(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (literal, chave: string) =>
    Object.hasOwn(valores, chave) ? String(valores[chave]) : literal,
  )
}
