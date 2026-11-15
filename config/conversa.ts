// Limites da conversa: tamanho da mensagem, o que o Intérprete lê de contexto e os tetos dos itens.
export const conversa = {
  maxCaracteres: 1000,
  interprete: { mensagensNoContexto: 4, maxCaracteresPorMensagem: 300, pendentesNoContexto: 5 },
  maxItensDeCasa: 10,
  maxEvitar: 5,
  maxFatoDeRotina: 200,
  maxNomeLivre: 40,
  caminhosForaDoPrompt: ["alerta", "fora", "ofensa"],
} as const
