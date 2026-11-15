import { llmCotas } from "@config/llm-cotas"

// Início do minuto em ISO UTC, usado como chave da janela de minuto.
export function janelaDoMinuto(agora: Date): string {
  return `${agora.toISOString().slice(0, 16)}:00.000Z`
}

// Dia da cota (AAAA-MM-DD) no fuso configurado: a virada do dia da cota é à meia-noite de Los Angeles.
export function diaDaCota(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: llmCotas.fusoDoDia,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora)
}
