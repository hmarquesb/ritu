// Textos da tela Como ficou? Placeholders {titulo}, {n} e {resultado} ficam no texto; quem usa substitui com `formatar`.
export const textosComoFicou = {
  titulo: "Como ficou?",
  texto: "Seu retorno me ajuda a acertar mais nas próximas vezes.",
  grupo: "Como ficou {titulo}?",
  ajudou: "Ajudou",
  naoAjudou: "Não ajudou",
  naoFez: "Não fiz",
  anotado: "Anotado: {resultado}.",
  dia: {
    hoje: "Hoje",
    ontem: "Ontem",
    dias: "Há {n} dias",
  },
  vazia: {
    titulo: "Nada esperando seu retorno.",
    texto: "Quando eu sugerir algo na conversa, aparece aqui.",
    link: "Ir para a conversa",
  },
  erro: "Não consegui anotar agora. Tente de novo.",
  noscript: "Para responder, ative o JavaScript.",
} as const
