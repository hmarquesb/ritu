// ⚠️ Publica o painel, os alertas, o contato de e-mail e a política na Grafana Cloud. Opt-in, fora dos gates.
// Confere o atual antes de gravar: cada item sai como criado, atualizado ou sem mudança.
// Não imprime e-mail nem token. Sai com 1 antes de gravar se a stack não tiver Prometheus da Cloud.
//   npm run painel:publicar
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { telemetria } from "@config/telemetria"
import { parse as lerYaml } from "yaml"
import { z } from "zod"
import { optionalEnv } from "@/infra/env"
import {
  CABECALHO_SEM_PROVENIENCIA,
  mudou,
  type Pedido,
  pedidoDaPasta,
  pedidoDaPolitica,
  pedidoDoContato,
  pedidoDoPainel,
  pedidosDasRegras,
  trocarDatasource,
  uidDoPrometheusCloud,
} from "./lib/painel-publicar"

const RAIZ = fileURLToPath(new URL("../", import.meta.url))
const { producao, uidDoPainel } = telemetria.grafana
const VARIAVEIS = ["GRAFANA_URL", "GRAFANA_TOKEN", "GRAFANA_ALERTA_EMAIL"]
const GRUPOS = z.looseObject({
  groups: z.array(z.looseObject({ name: z.string(), interval: z.string() })),
})

type Cliente = { url: string; token: string }
type Resposta = { status: number; corpo: unknown }
type Desfecho = "criado" | "atualizado" | "sem mudança"

class FalhaDePedido extends Error {
  constructor(caminho: string, status: number) {
    super(`${caminho} respondeu ${status}`)
  }
}

async function enviar(c: Cliente, pedido: Pedido): Promise<Resposta> {
  const resposta = await fetch(`${c.url}${pedido.caminho}`, {
    method: pedido.metodo,
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
      ...CABECALHO_SEM_PROVENIENCIA,
    },
    body: pedido.corpo === undefined ? undefined : JSON.stringify(pedido.corpo),
  })
  return { status: resposta.status, corpo: await resposta.json().catch(() => undefined) }
}

function ok(status: number): boolean {
  return status >= 200 && status < 300
}

async function gravar(c: Cliente, pedido: Pedido): Promise<void> {
  const { status } = await enviar(c, pedido)
  if (!ok(status)) throw new FalhaDePedido(pedido.caminho, status)
}

async function lerOuNaoExiste(c: Cliente, caminho: string): Promise<Resposta | null> {
  const resposta = await enviar(c, { metodo: "GET", caminho })
  if (resposta.status === 404) return null
  if (!ok(resposta.status)) throw new FalhaDePedido(caminho, resposta.status)
  return resposta
}

/** Só as chaves que o pedido manda: o Grafana acrescenta campos que não vêm do arquivo. */
function subconjunto(atual: unknown, novo: Record<string, unknown>): Record<string, unknown> {
  const campos = (atual ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.keys(novo).map((chave) => [chave, campos[chave]]))
}

/** Lê o atual; sem ele cria, com ele grava só se `mudar` devolver um pedido. */
async function sincronizar(
  c: Cliente,
  caminho: string,
  criar: Pedido,
  mudar: (atual: unknown) => Pedido | null,
): Promise<Desfecho> {
  const atual = await lerOuNaoExiste(c, caminho)
  if (atual === null) {
    await gravar(c, criar)
    return "criado"
  }
  const pedido = mudar(atual.corpo)
  if (pedido === null) return "sem mudança"
  await gravar(c, pedido)
  return "atualizado"
}

function imprimir(nome: string, desfecho: Desfecho): void {
  console.log(`${nome}: ${desfecho}`)
}

async function publicarPasta(c: Cliente): Promise<void> {
  const caminho = `/api/folders/${producao.uidDaPasta}`
  const desfecho = await sincronizar(c, caminho, pedidoDaPasta(), (atual) => {
    const titulo = (atual as { title?: unknown }).title
    if (titulo === producao.pasta) return null
    const { version } = atual as { version?: unknown }
    return {
      metodo: "PUT",
      caminho,
      corpo: { title: producao.pasta, version, overwrite: true },
    }
  })
  imprimir("pasta", desfecho)
}

async function publicarPainel(c: Cliente, painel: Record<string, unknown>): Promise<void> {
  const caminho = `/api/dashboards/uid/${uidDoPainel}`
  const pasta = producao.uidDaPasta
  const desfecho = await sincronizar(c, caminho, pedidoDoPainel(painel, pasta), (atual) => {
    const salvo = (atual as { dashboard?: unknown }).dashboard
    return mudou(subconjunto(salvo, painel), painel) ? pedidoDoPainel(painel, pasta) : null
  })
  imprimir("painel", desfecho)
}

async function publicarRegras(c: Cliente, regras: unknown): Promise<void> {
  for (const pedido of pedidosDasRegras(regras, producao.uidDaPasta)) {
    const corpo = pedido.corpo as Record<string, unknown>
    const desfecho = await sincronizar(
      c,
      pedido.caminho,
      { metodo: "POST", caminho: "/api/v1/provisioning/alert-rules", corpo },
      (atual) => (mudou(subconjunto(atual, corpo), corpo) ? pedido : null),
    )
    imprimir(`regra ${pedido.caminho.split("/").at(-1)}`, desfecho)
  }
}

/** `interval` do YAML ("1m", "30s", "1h") em segundos. */
function segundosDe(texto: string): number {
  const casamento = /^(\d+)([smh])$/.exec(texto)
  if (casamento === null) throw new Error(`intervalo fora do formato: ${texto}`)
  const fator = { s: 1, m: 60, h: 3600 }[casamento[2] as "s" | "m" | "h"]
  return Number(casamento[1]) * fator
}

async function publicarIntervalos(c: Cliente, documento: unknown): Promise<void> {
  for (const grupo of GRUPOS.parse(documento).groups) {
    const caminho = `/api/v1/provisioning/folder/${producao.uidDaPasta}/rule-groups/${grupo.name}`
    const interval = segundosDe(grupo.interval)
    const lido = await lerOuNaoExiste(c, caminho)
    if (lido === null) throw new FalhaDePedido(caminho, 404)
    const atual = (lido.corpo as { interval?: unknown }).interval
    if (atual === interval) {
      imprimir(`intervalo ${grupo.name}`, "sem mudança")
      continue
    }
    await gravar(c, { metodo: "PUT", caminho, corpo: { interval } })
    imprimir(`intervalo ${grupo.name}`, "atualizado")
  }
}

async function publicarContato(c: Cliente, email: string): Promise<void> {
  const contato = producao.contato
  const lista = await enviar(c, {
    metodo: "GET",
    caminho: `/api/v1/provisioning/contact-points?name=${contato}`,
  })
  if (!ok(lista.status))
    throw new FalhaDePedido("/api/v1/provisioning/contact-points", lista.status)
  const existente = Array.isArray(lista.corpo)
    ? (lista.corpo as { name?: unknown; settings?: unknown }[]).find((i) => i.name === contato)
    : undefined
  const novo = pedidoDoContato(email)
  if (existente === undefined) {
    await gravar(c, novo)
    imprimir("contato", "criado")
    return
  }
  const settings = novo.corpo as { settings: Record<string, unknown> }
  if (!mudou(subconjunto(existente.settings, settings.settings), settings.settings)) {
    imprimir("contato", "sem mudança")
    return
  }
  await gravar(c, {
    ...novo,
    metodo: "PUT",
    caminho: `/api/v1/provisioning/contact-points/${contato}`,
  })
  imprimir("contato", "atualizado")
}

async function publicarPolitica(c: Cliente): Promise<void> {
  const desfecho = await sincronizar(
    c,
    "/api/v1/provisioning/policies",
    pedidoDaPolitica(),
    (atual) => {
      const receptor = (atual as { receiver?: unknown }).receiver
      return receptor === producao.contato ? null : pedidoDaPolitica()
    },
  )
  imprimir("política", desfecho)
}

async function lerDocumento(caminho: string): Promise<unknown> {
  return lerYaml(await readFile(resolve(RAIZ, caminho), "utf8"))
}

async function lerPainel(): Promise<Record<string, unknown>> {
  const texto = await readFile(resolve(RAIZ, "observability/dashboards/ritu.json"), "utf8")
  return JSON.parse(texto) as Record<string, unknown>
}

async function uidDaCloud(c: Cliente): Promise<string | null> {
  const resposta = await enviar(c, { metodo: "GET", caminho: "/api/datasources" })
  return uidDoPrometheusCloud(ok(resposta.status) ? resposta.corpo : undefined)
}

async function main(): Promise<number> {
  const faltam = VARIAVEIS.filter((nome) => optionalEnv(nome) === undefined)
  if (faltam.length > 0) {
    console.error(`Faltam no .env.local: ${faltam.join(", ")}.`)
    return 2
  }
  const c: Cliente = {
    url: (optionalEnv("GRAFANA_URL") ?? "").replace(/\/$/, ""),
    token: optionalEnv("GRAFANA_TOKEN") ?? "",
  }
  const email = optionalEnv("GRAFANA_ALERTA_EMAIL") ?? ""

  const uidCloud = await uidDaCloud(c)
  if (uidCloud === null) {
    console.error("Não achei o Prometheus da Grafana Cloud. Nada foi gravado.")
    return 1
  }
  const regras = trocarDatasource(
    await lerDocumento("observability/grafana/alerting/ritu.yaml"),
    uidCloud,
  )
  await publicarPasta(c)
  await publicarPainel(c, await lerPainel())
  await publicarRegras(c, regras)
  await publicarIntervalos(c, regras)
  await publicarContato(c, email)
  await publicarPolitica(c)
  return 0
}

try {
  process.exitCode = await main()
} catch (erro) {
  console.error(
    erro instanceof FalhaDePedido ? erro.message : "Falha ao publicar: rede ou formato inesperado.",
  )
  process.exitCode = 1
}
