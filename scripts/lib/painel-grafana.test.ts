import { telemetria } from "@config/telemetria"
import { describe, expect, it } from "vitest"
import { ALERTAS, PAINEL } from "./painel"
import { gerarAlertas, gerarPainel } from "./painel-grafana"

type Dashboard = {
  uid: string
  title: string
  schemaVersion: number
  time: { from: string; to: string }
  templating: { list: { name: string; type: string; query?: string }[] }
  panels: PainelGrafana[]
}

type PainelGrafana = {
  id: number
  type: string
  title: string
  description?: string
  datasource?: { type: string; uid: string }
  gridPos: { x: number; y: number; w: number; h: number }
  fieldConfig?: {
    defaults: {
      unit?: string
      thresholds?: { steps: { color: string; value: number | null }[] }
    }
  }
  targets?: { expr?: string; query?: string; limit?: number; refId: string }[]
  panels?: PainelGrafana[]
  collapsed?: boolean
  transformations?: unknown[]
}

const painel = gerarPainel(PAINEL) as Dashboard

function paineisComuns(): PainelGrafana[] {
  return painel.panels.filter((p) => p.type !== "row")
}

function porTitulo(titulo: string): PainelGrafana {
  const achado = painel.panels.find((p) => p.title === titulo)
  if (!achado) throw new Error(`painel não encontrado: ${titulo}`)
  return achado
}

describe("gerarPainel", () => {
  it("usa uid, título, schemaVersion e intervalo da definição", () => {
    expect(painel.uid).toBe(telemetria.grafana.uidDoPainel)
    expect(painel.title).toBe("Ritu")
    expect(painel.schemaVersion).toBe(39)
    expect(painel.time).toEqual({ from: "now-24h", to: "now" })
  })

  it("declara as três variáveis de fonte de dados", () => {
    const porNome = Object.fromEntries(painel.templating.list.map((v) => [v.name, v]))
    expect(porNome.ds_metricas).toMatchObject({ type: "datasource", query: "prometheus" })
    expect(porNome.ds_logs).toMatchObject({ type: "datasource", query: "loki" })
    expect(porNome.ds_traces).toMatchObject({ type: "datasource", query: "tempo" })
  })

  it("tem uma linha recolhível por Linha, seguida dos painéis dela", () => {
    const linhas = painel.panels.filter((p) => p.type === "row")
    expect(linhas.map((l) => l.title)).toEqual(PAINEL.linhas.map((l) => l.titulo))
    for (const linha of linhas) {
      expect(linha.collapsed).toBe(false)
      expect(linha.gridPos.w).toBe(24)
    }
  })

  it("conta os painéis de cada linha", () => {
    const contagem = PAINEL.linhas.map((l) => l.paineis.length)
    expect(contagem).toEqual([6, 9, 7, 8, 2])
    expect(paineisComuns()).toHaveLength(32)
  })

  it("dá largura 12 aos painéis e 6 aos stat, com altura 8", () => {
    for (const p of paineisComuns()) {
      const esperada = p.type === "stat" ? 6 : 12
      expect(p.gridPos.w).toBe(esperada)
      expect(p.gridPos.h).toBe(8)
    }
  })

  it("não sobrepõe painéis e não passa de 24 colunas", () => {
    const retangulos = painel.panels.map((p) => p.gridPos)
    for (const r of retangulos) expect(r.x + r.w).toBeLessThanOrEqual(24)
    for (let i = 0; i < retangulos.length; i++) {
      for (let j = i + 1; j < retangulos.length; j++) {
        const a = retangulos[i]
        const b = retangulos[j]
        if (!a || !b) throw new Error("grade inconsistente")
        const seCruzam = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(seCruzam).toBe(false)
      }
    }
  })

  it("numera os ids em sequência", () => {
    const ids = painel.panels.map((p) => p.id)
    expect(ids).toEqual(ids.map((_, i) => i + 1))
  })

  it("copia a descrição e usa a fonte de dados pela fonte do painel", () => {
    const runs = porTitulo("Runs por hora")
    expect(runs.description).toBe(PAINEL.linhas[0]?.paineis[0]?.descricao)
    expect(runs.datasource).toEqual({ type: "prometheus", uid: `\${ds_metricas}` })
    expect(porTitulo("Avisos e erros").datasource).toEqual({ type: "loki", uid: `\${ds_logs}` })
    expect(porTitulo("Runs recentes").datasource).toEqual({ type: "tempo", uid: `\${ds_traces}` })
  })

  it("põe a unidade e os limites como thresholds verde, amarelo e vermelho", () => {
    const cota = porTitulo("Cota do dia")
    expect(cota.fieldConfig?.defaults.unit).toBe("percentunit")
    expect(cota.fieldConfig?.defaults.thresholds?.steps).toEqual([
      { color: "green", value: null },
      { color: "yellow", value: 0.8 },
      { color: "red", value: 1 },
    ])
    const falhas = porTitulo("Runs que falharam")
    expect(falhas.fieldConfig?.defaults.unit).toBe("percentunit")
    expect(falhas.fieldConfig?.defaults.thresholds?.steps.map((s) => s.value)).toEqual([
      null,
      0.05,
      0.1,
    ])
  })

  it("leva a consulta do rastro como TraceQL em tabela, com limite de 20", () => {
    const rastro = porTitulo("Runs recentes")
    expect(rastro.type).toBe("table")
    expect(rastro.targets?.[0]).toMatchObject({ query: '{ name = "run" }', limit: 20 })
  })

  it("leva a consulta do log ao painel de logs", () => {
    const logs = porTitulo("Avisos e erros")
    expect(logs.type).toBe("logs")
    expect(logs.targets?.[0]?.expr).toBe('{service_name="ritu"} | severity_text=~"WARN|ERROR"')
  })

  it("é determinístico", () => {
    expect(gerarPainel(PAINEL)).toEqual(gerarPainel(PAINEL))
  })
})

describe("gerarAlertas", () => {
  const yaml = gerarAlertas(ALERTAS)
  const doc = JSON.parse(yaml) as {
    apiVersion: number
    groups: {
      name: string
      folder: string
      interval: string
      rules: {
        uid: string
        title: string
        for: string
        noDataState: string
        execErrState: string
        labels: Record<string, string>
        annotations: { summary: string }
        data: { refId: string; model: { expr?: string; type?: string } }[]
      }[]
    }[]
  }
  const grupo = doc.groups[0]

  it("tem apiVersion 1 e um grupo ritu na pasta da definição, a cada 1m", () => {
    expect(doc.apiVersion).toBe(1)
    expect(doc.groups).toHaveLength(1)
    expect(grupo).toMatchObject({
      name: "ritu",
      folder: telemetria.grafana.pasta,
      interval: "1m",
    })
  })

  it("gera uma regra por alerta, com uid, título, pausa e resumo", () => {
    const regras = grupo?.rules ?? []
    expect(regras.map((r) => r.uid)).toEqual(ALERTAS.map((a) => a.uid))
    regras.forEach((r, i) => {
      const alerta = ALERTAS[i]
      if (!alerta) throw new Error("alerta faltando")
      expect(r.title).toBe(alerta.titulo)
      expect(r.for).toBe(alerta.para)
      expect(r.annotations.summary).toBe(alerta.resumo)
    })
  })

  it("trata sem dados como OK e erro de execução como Error, com gravidade aviso", () => {
    for (const r of grupo?.rules ?? []) {
      expect(r.noDataState).toBe("OK")
      expect(r.execErrState).toBe("Error")
      expect(r.labels).toEqual({ gravidade: "aviso" })
    }
  })

  it("consulta o Prometheus pela expressão do alerta, nos últimos 10 min", () => {
    const primeira = grupo?.rules[0]?.data[0]
    expect(primeira).toMatchObject({
      refId: "A",
      model: { expr: ALERTAS[0]?.expr },
    })
    expect(yaml).toContain(`"datasourceUid": "${telemetria.grafana.uidMetricas}"`)
    expect(yaml).toContain('"from": 600')
  })

  it("não tem política nem ponto de contato", () => {
    expect(yaml).not.toContain("contactPoints")
    expect(yaml).not.toContain("policies")
  })

  it("é determinístico", () => {
    expect(gerarAlertas(ALERTAS)).toBe(gerarAlertas(ALERTAS))
  })
})
