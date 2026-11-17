import { config } from "@config/index"
import { getContainer } from "@/infra/container"

/** Perguntas, doshas e textos do quiz, prontos para o componente `Quiz`. */
export function propsDoQuiz() {
  const { quiz: perguntas, doshas } = getContainer().knowledge
  return {
    perguntas: perguntas.map(({ id, texto, opcoes }) => ({ id, texto, opcoes: [...opcoes] })),
    doshas: doshas.map(({ id, nome, resumo }) => ({ id, nome, resumo })),
    textos: config.textosEntrada.quiz,
  }
}
