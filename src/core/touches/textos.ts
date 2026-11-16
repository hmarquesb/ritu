// Textos fixos dos toques da tela. O marcador é trocado pelo montador abaixo.
export const textosDosToques = {
  semSubstituto: "Não achei uma troca para {item} com o que você tem em casa.",
} as const

// Troca com função: o nome vindo do banco não é reinterpretado ($&, {item}).
export function textoSemSubstituto(nome: string): string {
  const item = nome.toLocaleLowerCase("pt-BR")
  return textosDosToques.semSubstituto.replace("{item}", () => item)
}
