import { telemetria } from "@config/telemetria"
import { z } from "zod"

export type Pedido = { metodo: "GET" | "POST" | "PUT"; caminho: string; corpo?: unknown }

const { producao, uidMetricas } = telemetria.grafana
const CAMPOS_DE_REGISTRO = new Set([
  "id",
  "version",
  "updated",
  "created",
  "provenance",
  "updatedAt",
  "createdAt",
])

export const CABECALHO_SEM_PROVENIENCIA = { "X-Disable-Provenance": "true" }

const grupos = z.object({
  groups: z.array(
    z.looseObject({
      name: z.string(),
      rules: z.array(z.looseObject({ uid: z.string() })),
    }),
  ),
})

const datasource = z.looseObject({ type: z.string(), name: z.string(), uid: z.string() })

function clonar(no: unknown, ajustar: (chave: string, valor: unknown) => unknown): unknown {
  if (Array.isArray(no)) return no.map((item) => clonar(item, ajustar))
  if (no !== null && typeof no === "object") {
    return Object.fromEntries(
      Object.entries(no).map(([chave, valor]) => [chave, ajustar(chave, clonar(valor, ajustar))]),
    )
  }
  return no
}

function semRegistro(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(semRegistro)
  if (no !== null && typeof no === "object") {
    return Object.fromEntries(
      Object.entries(no)
        .filter(([chave]) => !CAMPOS_DE_REGISTRO.has(chave))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, valor]) => [chave, semRegistro(valor)]),
    )
  }
  return no
}

/** Troca o datasourceUid do Prometheus local pelo da stack Cloud; a expressão de `__expr__` fica. */
export function trocarDatasource(regras: unknown, uidCloud: string): unknown {
  return clonar(regras, (chave, valor) =>
    chave === "datasourceUid" && valor === uidMetricas ? uidCloud : valor,
  )
}

/** Um PUT por regra, com o uid na URL; a pasta e o grupo vão no corpo. */
export function pedidosDasRegras(regras: unknown, pastaUid: string): Pedido[] {
  const documento = grupos.parse(regras)
  return documento.groups.flatMap((grupo) =>
    grupo.rules.map((regra) => ({
      metodo: "PUT" as const,
      caminho: `/api/v1/provisioning/alert-rules/${regra.uid}`,
      corpo: { ...regra, folderUID: pastaUid, ruleGroup: grupo.name },
    })),
  )
}

export function pedidoDoPainel(painel: object, pastaUid: string): Pedido {
  const { id: _id, ...dashboard } = painel as Record<string, unknown>
  return {
    metodo: "POST",
    caminho: "/api/dashboards/db",
    corpo: { dashboard, folderUid: pastaUid, overwrite: true },
  }
}

export function pedidoDoContato(email: string): Pedido {
  return {
    metodo: "POST",
    caminho: "/api/v1/provisioning/contact-points",
    corpo: {
      uid: producao.contato,
      name: producao.contato,
      type: "email",
      settings: { addresses: email },
    },
  }
}

export function pedidoDaPolitica(): Pedido {
  return {
    metodo: "PUT",
    caminho: "/api/v1/provisioning/policies",
    corpo: { receiver: producao.contato },
  }
}

export function pedidoDaPasta(): Pedido {
  return {
    metodo: "POST",
    caminho: "/api/folders",
    corpo: { uid: producao.uidDaPasta, title: producao.pasta },
  }
}

/** Primeiro Prometheus cuja stack começa com `grafanacloud-`. */
export function uidDoPrometheusCloud(datasources: unknown): string | null {
  if (!Array.isArray(datasources)) return null
  for (const item of datasources) {
    const lido = datasource.safeParse(item)
    if (
      lido.success &&
      lido.data.type === "prometheus" &&
      lido.data.name.startsWith("grafanacloud-")
    ) {
      return lido.data.uid
    }
  }
  return null
}

/** Compara duas respostas do Grafana sem os campos de registro (id, versão, datas, proveniência). */
export function mudou(atual: unknown, novo: unknown): boolean {
  return JSON.stringify(semRegistro(atual)) !== JSON.stringify(semRegistro(novo))
}
