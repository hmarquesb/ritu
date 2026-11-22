import { readFileSync } from "node:fs"
import { telemetria } from "@config/telemetria"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parse } from "yaml"
import {
  CABECALHO_SEM_PROVENIENCIA,
  mudou,
  pedidoDaPasta,
  pedidoDaPolitica,
  pedidoDoContato,
  pedidoDoPainel,
  pedidosDasRegras,
  trocarDatasource,
  uidDoPrometheusCloud,
} from "./painel-publicar"

const ARQUIVO_REGRAS = new URL("../../observability/grafana/alerting/ritu.yaml", import.meta.url)
const ARQUIVO_PAINEL = new URL("../../observability/dashboards/ritu.json", import.meta.url)
const UID_CLOUD = "stack-exemplo-prom"
const EMAIL = "alguem@exemplo.com"

function regrasReais(): unknown {
  return parse(readFileSync(ARQUIVO_REGRAS, "utf8"))
}

function painelReal(): Record<string, unknown> {
  return JSON.parse(readFileSync(ARQUIVO_PAINEL, "utf8"))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("trocarDatasource", () => {
  it("troca todo datasourceUid do Prometheus local e mantém a expressão", () => {
    const trocado = JSON.stringify(trocarDatasource(regrasReais(), UID_CLOUD))
    expect(trocado).not.toContain('"prometheus"')
    expect(trocado).toContain(`"datasourceUid":"${UID_CLOUD}"`)
    expect(trocado).toContain('"datasourceUid":"__expr__"')
  })

  it("não muda a entrada", () => {
    const original = regrasReais()
    const antes = JSON.stringify(original)
    trocarDatasource(original, UID_CLOUD)
    expect(JSON.stringify(original)).toBe(antes)
  })
})

describe("pedidosDasRegras", () => {
  it("faz um PUT por regra, com o uid na URL e a pasta e o grupo no corpo", () => {
    const pedidos = pedidosDasRegras(trocarDatasource(regrasReais(), UID_CLOUD), "ritu")
    expect(pedidos).toHaveLength(5)
    for (const pedido of pedidos) {
      expect(pedido.metodo).toBe("PUT")
      const corpo = pedido.corpo as { uid: string; folderUID: string; ruleGroup: string }
      expect(pedido.caminho).toBe(`/api/v1/provisioning/alert-rules/${corpo.uid}`)
      expect(corpo.folderUID).toBe("ritu")
      expect(corpo.ruleGroup).toBe("ritu")
    }
  })
})

describe("pedidoDoContato", () => {
  it("monta o ponto de contato de e-mail sem logar o endereço", () => {
    const log = vi.spyOn(console, "log")
    const pedido = pedidoDoContato(EMAIL)
    expect(log).not.toHaveBeenCalled()
    expect(pedido.metodo).toBe("POST")
    expect(pedido.caminho).toBe("/api/v1/provisioning/contact-points")
    expect(pedido.corpo).toEqual({
      uid: "ritu-email",
      name: "ritu-email",
      type: "email",
      settings: { addresses: EMAIL },
    })
  })
})

describe("pedidaDaPolitica e pedidoDaPasta", () => {
  it("põe o receptor raiz na política de notificação", () => {
    expect(pedidoDaPolitica()).toEqual({
      metodo: "PUT",
      caminho: "/api/v1/provisioning/policies",
      corpo: { receiver: "ritu-email" },
    })
  })

  it("cria a pasta Ritu com o uid ritu", () => {
    expect(pedidoDaPasta()).toEqual({
      metodo: "POST",
      caminho: "/api/folders",
      corpo: { uid: "ritu", title: "Ritu" },
    })
  })
})

describe("pedidoDoPainel", () => {
  it("salva o painel real na pasta, sem o id e sobrescrevendo", () => {
    const pedido = pedidoDoPainel({ ...painelReal(), id: 42 }, "ritu")
    expect(pedido.metodo).toBe("POST")
    expect(pedido.caminho).toBe("/api/dashboards/db")
    const corpo = pedido.corpo as {
      dashboard: Record<string, unknown>
      folderUid: string
      overwrite: boolean
    }
    expect(corpo.dashboard).not.toHaveProperty("id")
    expect(corpo.dashboard.uid).toBe(painelReal().uid)
    expect(corpo.folderUid).toBe("ritu")
    expect(corpo.overwrite).toBe(true)
  })
})

describe("uidDoPrometheusCloud", () => {
  const datasources = [
    { type: "prometheus", name: "local", uid: "local-uid" },
    { type: "loki", name: "grafanacloud-logs", uid: "logs-uid" },
    { type: "prometheus", name: "grafanacloud-ritu-prom", uid: UID_CLOUD },
  ]

  it("acha o Prometheus da stack Cloud", () => {
    expect(uidDoPrometheusCloud(datasources)).toBe(UID_CLOUD)
  })

  it("devolve null sem a stack Cloud ou sem lista", () => {
    expect(uidDoPrometheusCloud([datasources[0]])).toBeNull()
    expect(uidDoPrometheusCloud("não é lista")).toBeNull()
  })
})

describe("mudou", () => {
  const base = {
    uid: "x",
    title: "Cota",
    id: 1,
    version: 2,
    updated: "2026-01-01T00:00:00Z",
    provenance: "api",
  }

  it("ignora id, versão, datas e proveniência", () => {
    const outro = {
      uid: "x",
      title: "Cota",
      id: 9,
      version: 7,
      updated: "2026-11-17T10:00:00Z",
      provenance: "",
    }
    expect(mudou(base, outro)).toBe(false)
  })

  it("percebe um campo real diferente", () => {
    expect(mudou(base, { ...base, title: "Outra" })).toBe(true)
  })
})

describe("CABECALHO_SEM_PROVENIENCIA", () => {
  it("desliga a proveniência nas escritas", () => {
    expect(CABECALHO_SEM_PROVENIENCIA).toEqual({ "X-Disable-Provenance": "true" })
    expect(telemetria.grafana.producao.pasta).toBe("Ritu")
  })
})
