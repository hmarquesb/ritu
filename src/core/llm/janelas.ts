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

// Próxima meia-noite do fuso da cota, como instante absoluto.
export function viradaDaCota(agora: Date): Date {
  const [ano, mes, dia] = diaDaCota(agora).split("-").map(Number)
  const meiaNoiteLocal = Date.UTC(ano ?? 0, (mes ?? 1) - 1, (dia ?? 1) + 1)
  const deslocamento = deslocamentoDoFuso(meiaNoiteLocal, llmCotas.fusoDoDia)
  const primeiro = meiaNoiteLocal - deslocamento
  // Refina uma vez: o deslocamento pode mudar entre a estimativa e o instante final (horário de verão).
  return new Date(meiaNoiteLocal - deslocamentoDoFuso(primeiro, llmCotas.fusoDoDia))
}

// Hora local do fuso como texto: "5h", ou "5h30" quando há minutos.
export function horaLocal(data: Date, fuso: string): string {
  const { hora, minuto } = partesNoFuso(data, fuso)
  if (minuto === 0) return `${hora}h`
  return `${hora}h${String(minuto).padStart(2, "0")}`
}

// Diferença, em ms, entre o relógio do fuso (lido como UTC) e o instante.
function deslocamentoDoFuso(instante: number, fuso: string): number {
  const { ano, mes, dia, hora, minuto, segundo } = partesNoFuso(new Date(instante), fuso)
  const relogio = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo)
  return relogio - Math.floor(instante / 1000) * 1000
}

type Partes = {
  ano: number
  mes: number
  dia: number
  hora: number
  minuto: number
  segundo: number
}

function partesNoFuso(data: Date, fuso: string): Partes {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  })
  const valores = Object.fromEntries(
    formato.formatToParts(data).map((p) => [p.type, Number(p.value)]),
  )
  return {
    ano: valores.year ?? 0,
    mes: valores.month ?? 1,
    dia: valores.day ?? 1,
    hora: (valores.hour ?? 0) % 24,
    minuto: valores.minute ?? 0,
    segundo: valores.second ?? 0,
  }
}
