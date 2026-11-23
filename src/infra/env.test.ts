import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { MissingEnvError } from "@/core/errors"
import {
  contatoPrivacidade,
  ENV_VARS,
  type EnvVar,
  envStatus,
  faltandoEmProducao,
  optionalEnv,
  requireEnv,
  testers,
  type UsoEmProducao,
} from "./env"

const ENV_EXAMPLE = fileURLToPath(new URL("../../.env.example", import.meta.url))

describe("testers", () => {
  it("lê TESTER_IDS separado por vírgula, normalizado e sem itens vazios", () => {
    expect(testers({ TESTER_IDS: " A@x.com, ,b@y.com" })).toEqual(["a@x.com", "b@y.com"])
  })

  it.each([
    ["ausente", {}],
    ["vazia", { TESTER_IDS: "" }],
    ["só espaços", { TESTER_IDS: "   " }],
  ])("devolve lista vazia quando a variável está %s", (_, env) => {
    expect(testers(env)).toEqual([])
  })

  it("a descrição no catálogo diz que não tem limite de uso", () => {
    const variavel = ENV_VARS.find((item) => item.name === "TESTER_IDS")
    expect(variavel?.descricao).toBe("E-mails do Google, separados por vírgula, sem limite de uso.")
  })
})

describe("CONTATO_PRIVACIDADE", () => {
  it("está no catálogo como obrigatória em produção, nova da entrega 4 e não obrigatória fora dela", () => {
    expect(ENV_VARS.find((item) => item.name === "CONTATO_PRIVACIDADE")).toMatchObject({
      entrega: 4,
      obrigatoria: false,
      producao: "obrigatoria",
    })
  })

  it("o leitor devolve o valor cru, sem validar nem aparar", () => {
    expect(contatoPrivacidade({ CONTATO_PRIVACIDADE: "  nao-e-email " })).toBe("  nao-e-email ")
  })

  it.each([
    ["ausente", {}],
    ["vazia", { CONTATO_PRIVACIDADE: "" }],
    ["só espaços", { CONTATO_PRIVACIDADE: "   " }],
  ])("devolve undefined quando a variável está %s", (_, env) => {
    expect(contatoPrivacidade(env)).toBeUndefined()
  })
})

describe("RITU_MODO", () => {
  const variavel = ENV_VARS.find((item) => item.name === "RITU_MODO")

  it("está no catálogo, opcional, da entrega 3, então o check da entrega 3 não falha sem ela", () => {
    expect(variavel).toMatchObject({ name: "RITU_MODO", entrega: 3, obrigatoria: false })
  })
})

const VALORES_DE_EXEMPLO = new Set([
  "DATABASE_URL",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
])

describe("requireEnv", () => {
  it.each([
    ["ausente", {}],
    ["vazia", { X: "" }],
    ["só espaços", { X: "   " }],
  ])("lança MissingEnvError quando a variável está %s", (_, env) => {
    expect(() => requireEnv("X", env)).toThrow(MissingEnvError)
    expect(() => requireEnv("X", env)).toThrow("Defina X no .env.local")
  })

  it("devolve o valor quando a variável está definida", () => {
    expect(requireEnv("X", { X: "v" })).toBe("v")
  })
})

describe("optionalEnv", () => {
  it("devolve undefined para variável vazia ou ausente", () => {
    expect(optionalEnv("X", { X: "" })).toBeUndefined()
    expect(optionalEnv("X", { X: "  " })).toBeUndefined()
    expect(optionalEnv("X", {})).toBeUndefined()
  })

  it("devolve o valor quando a variável está definida", () => {
    expect(optionalEnv("X", { X: "v" })).toBe("v")
  })
})

describe("envStatus", () => {
  const status = envStatus({ DATABASE_URL: "x", EXTRA: "y" })

  it("lista só as variáveis do catálogo, sem as de fora", () => {
    expect(status).toHaveLength(23)
    expect(status.map((item) => item.name)).not.toContain("EXTRA")
  })

  it("marca presença pelo valor, não pelo nome", () => {
    const porNome = Object.fromEntries(status.map((item) => [item.name, item.presente]))

    expect(porNome.DATABASE_URL).toBe(true)
    expect(porNome.GEMINI_API_KEY).toBe(false)
  })

  it("segue a ordem do catálogo e expõe entrega e obrigatoriedade", () => {
    expect(status.map((item) => item.name)).toEqual(ENV_VARS.map((v) => v.name))
    expect(status[0]).toEqual({
      name: "DATABASE_URL",
      entrega: 1,
      obrigatoria: true,
      presente: true,
    })
  })

  it("trata string só com espaços como ausente", () => {
    const porNome = Object.fromEntries(
      envStatus({ DATABASE_URL: "   " }).map((item) => [item.name, item.presente]),
    )

    expect(porNome.DATABASE_URL).toBe(false)
  })
})

describe(".env.example", () => {
  const linhas = readFileSync(ENV_EXAMPLE, "utf8").split("\n")
  const variaveis = linhas
    .filter((linha) => linha.trim() !== "" && !linha.startsWith("#"))
    .map((linha) => {
      const cortePrimeiro = linha.indexOf("=")
      return {
        name: linha.slice(0, cortePrimeiro),
        valor: linha.slice(cortePrimeiro + 1),
      }
    })

  it("tem os nomes do catálogo, na mesma ordem", () => {
    expect(variaveis.map((v) => v.name)).toEqual(ENV_VARS.map((v) => v.name))
  })

  it("tem comentário de uma linha antes de cada variável", () => {
    const indicesDeVariavel = linhas
      .map((linha, indice) => ({ linha, indice }))
      .filter(({ linha }) => linha.includes("=") && !linha.startsWith("#"))
      .map(({ indice }) => indice)

    for (const indice of indicesDeVariavel) {
      expect(linhas[indice - 1]?.startsWith("#")).toBe(true)
    }
  })

  it("só tem valor nas três variáveis de exemplo", () => {
    const comValor = variaveis.filter((v) => v.valor !== "").map((v) => v.name)

    expect(comValor.sort()).toEqual([...VALORES_DE_EXEMPLO].sort())
  })
})

const USOS: readonly UsoEmProducao[] = [
  "obrigatoria",
  "opcional",
  "proibida",
  "local",
  "por_deploy",
]

/** Linhas da tabela de T4: nome, uso em produção e descrição. */
const TABELA_PRODUCAO: readonly [string, UsoEmProducao, string][] = [
  ["DATABASE_URL", "obrigatoria", "Postgres. Em produção, a URL do Neon com pooler"],
  ["GEMINI_API_KEY", "obrigatoria", "Em produção, a chave do projeto de produção"],
  ["GEMINI_API_KEY_2", "local", "Chave de outro projeto do Google, só para os evals com LLM"],
  ["GEMINI_API_KEY_3", "local", "Chave de outro projeto do Google, só para os evals com LLM"],
  ["AUTH_SECRET", "obrigatoria", "Sessão."],
  ["IP_HMAC_SECRET", "obrigatoria", "HMAC do IP nos limites."],
  ["CRON_SECRET", "obrigatoria", "Autenticação do cron."],
  ["AUTH_GOOGLE_ID", "obrigatoria", "Login Google; sem ela a Entrada mostra só a demonstração."],
  [
    "AUTH_GOOGLE_SECRET",
    "obrigatoria",
    "Login Google; sem ela a Entrada mostra só a demonstração.",
  ],
  ["RITU_MODO", "proibida", "e2e: stores em memória para o Playwright. Recusada em produção."],
  ["TESTER_IDS", "opcional", "E-mails do Google, separados por vírgula, sem limite de uso."],
  ["OTEL_EXPORTER_OTLP_ENDPOINT", "obrigatoria", "Em produção, endpoint e token do Grafana Cloud."],
  ["OTEL_EXPORTER_OTLP_HEADERS", "obrigatoria", "Em produção, endpoint e token do Grafana Cloud."],
  ["OTEL_SERVICE_NAME", "opcional", "Padrão ritu."],
  ["RITU_VERSAO", "por_deploy", "Sha do commit, posto pela CI em cada deploy."],
  ["VERCEL_TOKEN", "local", "Para `env:producao` à mão."],
  ["VERCEL_ORG_ID", "local", "Para `env:producao` à mão."],
  ["VERCEL_PROJECT_ID", "local", "Para `env:producao` à mão."],
  ["GRAFANA_URL", "local", "Para `painel:publicar`."],
  ["GRAFANA_TOKEN", "local", "Para `painel:publicar`."],
  ["GRAFANA_ALERTA_EMAIL", "local", "Para `painel:publicar`."],
  ["SITE_URL", "local", "URL de produção, para `smoke` e `smoke:completo`."],
  [
    "CONTATO_PRIVACIDADE",
    "obrigatoria",
    "E-mail mostrado na política de privacidade. Nova, entrega 4, não obrigatória fora de produção",
  ],
]

const NOVAS_ENTREGA_4 = [
  "RITU_VERSAO",
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "GRAFANA_URL",
  "GRAFANA_TOKEN",
  "GRAFANA_ALERTA_EMAIL",
  "SITE_URL",
  "CONTATO_PRIVACIDADE",
]

function variavel(name: string, producao: UsoEmProducao, obrigatoria = false): EnvVar {
  return { name, entrega: 1, obrigatoria, producao, descricao: "" }
}

describe("uso em produção no catálogo", () => {
  it("toda entrada tem producao válido", () => {
    for (const item of ENV_VARS) {
      expect(USOS).toContain(item.producao)
    }
  })

  it("as linhas batem com a tabela de T4: nome, uso e descrição", () => {
    expect(ENV_VARS.map((item) => item.name)).toEqual(TABELA_PRODUCAO.map(([nome]) => nome))

    for (const [nome, producao, descricao] of TABELA_PRODUCAO) {
      expect(ENV_VARS.find((item) => item.name === nome)).toMatchObject({ producao, descricao })
    }
  })

  it("as variáveis novas da entrega 4 entram como não obrigatórias", () => {
    for (const nome of NOVAS_ENTREGA_4) {
      expect(ENV_VARS.find((item) => item.name === nome)).toMatchObject({
        entrega: 4,
        obrigatoria: false,
      })
    }
  })

  it("cada nome do catálogo está no .env.example, com a descrição como comentário", () => {
    const linhas = readFileSync(ENV_EXAMPLE, "utf8").split("\n")

    for (const item of ENV_VARS) {
      const indice = linhas.findIndex((linha) => linha.startsWith(`${item.name}=`))
      expect(indice, item.name).toBeGreaterThan(-1)
      expect(linhas[indice - 1], item.name).toBe(`# ${item.descricao}`)
    }
  })

  it("as variáveis novas no .env.example têm valor vazio", () => {
    const linhas = readFileSync(ENV_EXAMPLE, "utf8").split("\n")

    for (const nome of NOVAS_ENTREGA_4) {
      expect(linhas).toContain(`${nome}=`)
    }
  })
})

describe("faltandoEmProducao", () => {
  const obrigatorias = ENV_VARS.filter((item) => item.producao === "obrigatoria").map(
    (item) => item.name,
  )

  it("aponta obrigatória ausente, na ordem do catálogo", () => {
    expect(faltandoEmProducao(ENV_VARS, [])).toEqual({ ausentes: obrigatorias, proibidas: [] })
  })

  it("aponta proibida presente (RITU_MODO)", () => {
    expect(faltandoEmProducao(ENV_VARS, [...obrigatorias, "RITU_MODO"])).toEqual({
      ausentes: [],
      proibidas: ["RITU_MODO"],
    })
  })

  it("ignora local e por_deploy, presentes ou ausentes", () => {
    const catalogo = [variavel("LOCAL", "local"), variavel("DEPLOY", "por_deploy")]

    expect(faltandoEmProducao(catalogo, [])).toEqual({ ausentes: [], proibidas: [] })
    expect(faltandoEmProducao(catalogo, ["LOCAL", "DEPLOY"])).toEqual({
      ausentes: [],
      proibidas: [],
    })
  })

  it("devolve listas vazias quando tudo está certo", () => {
    expect(faltandoEmProducao(ENV_VARS, obrigatorias)).toEqual({ ausentes: [], proibidas: [] })
  })

  it("segue a ordem do catálogo, não a da lista de nomes", () => {
    const catalogo = [
      variavel("B", "obrigatoria"),
      variavel("A", "obrigatoria"),
      variavel("C", "obrigatoria"),
    ]

    expect(faltandoEmProducao(catalogo, ["C"]).ausentes).toEqual(["B", "A"])
  })
})

describe("importação de env.ts", () => {
  it("não lê process.env ao ser importado", async () => {
    const original = process.env
    const acessos = vi.fn()
    process.env = new Proxy({} as NodeJS.ProcessEnv, {
      get: (_, chave) => {
        acessos(chave)
        return undefined
      },
      has: () => {
        acessos("has")
        return false
      },
    })

    try {
      vi.resetModules()
      await import("./env")

      expect(acessos).not.toHaveBeenCalled()
    } finally {
      process.env = original
    }
  })
})
