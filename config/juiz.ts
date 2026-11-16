export const juiz = {
  maxTentativas: 2, // leituras do Juiz por run
  chamadasDaNovaTentativa: 2, // chamadas de modelo a mais para o Acompanhante corrigir a resposta
  maxTrecho: 120, // tamanho máximo, em caracteres, de cada trecho apontado pelo Juiz
  graves: [
    "promessa",
    "dosagem",
    "conselho",
    "evitar_sempre",
    "texto_diferente",
    "motivo_sem_base",
    "para_ter",
    "vulgar",
    "tom",
  ], // motivos que reprovam a resposta
  registros: ["jargao"], // motivos de registro que só viram aviso, sem reprovar
} as const
