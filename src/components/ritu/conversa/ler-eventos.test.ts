import { describe, expect, it } from "vitest"
import type { EventoDaTela } from "@/core/conversation/eventos"
import type { VisaoDoRun } from "@/core/conversation/visao"
import { lerEventos } from "./ler-eventos"

const visao: VisaoDoRun = {
  run_id: "run-1",
  status: "done",
  caminho: "acompanhante",
  frases: [{ chave: "entendendo", texto: "Entendendo o que você disse" }],
  avisos: [],
  sugestoes: [],
  evitar: [],
  geral: false,
  podeVotar: true,
}

const inicio: EventoDaTela = { tipo: "inicio", run_id: "run-1" }
const etapa: EventoDaTela = {
  tipo: "etapa",
  frase: { chave: "clima", texto: "Olhando o clima de hoje" },
}
const fim: EventoDaTela = {
  tipo: "fim",
  visao,
  pendentes: 2,
  limites: { mensagens: { tipo: "livre" }, cota_ia: { esgotada: false } },
}
const erro: EventoDaTela = { tipo: "erro", erro: "run_nao_encontrado" }

const EVENTOS: EventoDaTela[] = [inicio, etapa, fim, erro]

const codificarEvento = (e: EventoDaTela): string => `${JSON.stringify(e)}\n`

const codificador = new TextEncoder()

async function lerTudo(partes: Uint8Array[]): Promise<EventoDaTela[]> {
  const origem = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const parte of partes) controller.enqueue(parte)
      controller.close()
    },
  })
  const saida: EventoDaTela[] = []
  const leitor = origem.pipeThrough(lerEventos()).getReader()
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) return saida
    saida.push(value)
  }
}

function bytes(texto: string): Uint8Array {
  return codificador.encode(texto)
}

describe("lerEventos", () => {
  it.each(EVENTOS.map((e) => [e.tipo, e] as const))(
    "ida e volta do tipo %s",
    async (_tipo, evento) => {
      const lidos = await lerTudo([bytes(codificarEvento(evento))])
      expect(lidos).toEqual([evento])
    },
  )

  it("lê vários eventos seguidos na ordem", async () => {
    const texto = EVENTOS.map(codificarEvento).join("")
    expect(await lerTudo([bytes(texto)])).toEqual(EVENTOS)
  })

  it("junta uma linha partida em dois pedaços", async () => {
    const todo = bytes(codificarEvento(fim))
    const meio = Math.floor(todo.length / 2)
    const lidos = await lerTudo([todo.slice(0, meio), todo.slice(meio)])
    expect(lidos).toEqual([fim])
  })

  it("junta um caractere multibyte partido entre pedaços", async () => {
    const evento: EventoDaTela = {
      tipo: "etapa",
      frase: { chave: "memoria", texto: "Lembrando 👍 de você" },
    }
    const todo = bytes(codificarEvento(evento))
    const inicioDoEmoji = todo.indexOf(0xf0)
    expect(inicioDoEmoji).toBeGreaterThan(0)
    const corte = inicioDoEmoji + 2
    const lidos = await lerTudo([todo.slice(0, corte), todo.slice(corte)])
    expect(lidos).toEqual([evento])
  })

  it("pula linha inválida no meio, linha vazia e objeto sem tipo conhecido", async () => {
    const texto = [
      codificarEvento(inicio),
      "isto não é json\n",
      "\n",
      `${JSON.stringify({ x: 1 })}\n`,
      `${JSON.stringify({ tipo: "desconhecido" })}\n`,
      "null\n",
      codificarEvento(erro),
    ].join("")
    expect(await lerTudo([bytes(texto)])).toEqual([inicio, erro])
  })

  it("emite a última linha quando ela não tem quebra no fim", async () => {
    const semQuebra = JSON.stringify(etapa)
    expect(semQuebra.endsWith("\n")).toBe(false)
    const lidos = await lerTudo([bytes(codificarEvento(inicio) + semQuebra)])
    expect(lidos).toEqual([inicio, etapa])
  })

  it("não emite nada para um fluxo vazio", async () => {
    expect(await lerTudo([])).toEqual([])
  })
})
