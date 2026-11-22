import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

type Passo = {
  name?: string
  id?: string
  if?: string
  run?: string
  uses?: string
  env?: Record<string, string>
  "continue-on-error"?: boolean
}
type Job = {
  needs?: string | string[]
  if?: string
  environment?: string
  concurrency?: { group: string; "cancel-in-progress": boolean }
  steps: Passo[]
}
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> }

const raiz = fileURLToPath(new URL("..", import.meta.url))
const lerTexto = (arquivo: string) => readFileSync(`${raiz}${arquivo}`, "utf8")
const ci = parse(lerTexto(".github/workflows/ci.yml")) as Workflow
const dependabot = parse(lerTexto(".github/dependabot.yml")) as {
  version: number
  updates: Array<Record<string, unknown>>
}

const jobDe = (nome: string): Job => {
  const job = ci.jobs[nome]
  if (!job) throw new Error(`job "${nome}" ausente`)
  return job
}
const nomes = (job: Job) => job.steps.map((passo) => passo.name)
const passoNomeado = (job: Job, nome: string) => {
  const passo = job.steps.find((item) => item.name === nome)
  if (!passo) throw new Error(`passo "${nome}" ausente`)
  return passo
}

const VERSAO_VERCEL = "vercel@65.17.0"

describe("CI: disparo manual", () => {
  it("aceita workflow_dispatch e mantém push e pull_request", () => {
    expect(ci.on).toHaveProperty("workflow_dispatch")
    expect(ci.on).toHaveProperty("push")
    expect(ci.on).toHaveProperty("pull_request")
  })
})

describe("CI: auditoria no job gates", () => {
  const gates = jobDe("gates")
  const ordem = nomes(gates)

  it("tem o passo Auditoria com o audit-ci fixado e a configuração do repositório", () => {
    expect(passoNomeado(gates, "Auditoria").run).toBe(
      "npx --yes audit-ci@7.1.0 --config audit-ci.jsonc",
    )
  })

  it("a configuração barra alta e crítica, ignora dev e só libera advisories pelo id", () => {
    const config = parse(lerTexto("audit-ci.jsonc").replace(/^\s*\/\/.*$/gm, "")) as {
      high?: boolean
      "skip-dev"?: boolean
      allowlist?: string[]
    }
    expect(config.high).toBe(true)
    expect(config["skip-dev"]).toBe(true)
    for (const id of config.allowlist ?? []) expect(id).toMatch(/^GHSA(-[0-9a-z]{4}){3}$/)
  })

  it("fica logo depois de Instalar dependências e antes do Build", () => {
    const i = ordem.indexOf("Instalar dependências")
    expect(ordem[i + 1]).toBe("Auditoria")
    expect(ordem.indexOf("Auditoria")).toBeLessThan(ordem.indexOf("Build"))
  })
})

describe("CI: jobs evals e db intocados", () => {
  it("evals mantém os passos de antes", () => {
    expect(nomes(jobDe("evals"))).toEqual([
      undefined,
      undefined,
      "Instalar dependências",
      "Evals determinísticos",
      "Resumo dos evals determinísticos",
    ])
  })

  it("db mantém os passos de antes", () => {
    expect(nomes(jobDe("db"))).toEqual([
      undefined,
      undefined,
      "Instalar dependências",
      "Migrações",
      "Testes de banco",
    ])
  })
})

describe("CI: job deploy", () => {
  const deploy = jobDe("deploy")

  it("só roda depois de gates e db, em main, em push ou disparo manual", () => {
    expect(deploy.needs).toEqual(["gates", "db"])
    expect(deploy.if).toBe(
      "github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
    )
  })

  it("usa o ambiente producao e a fila única sem cancelar", () => {
    expect(deploy.environment).toBe("producao")
    expect(deploy.concurrency).toEqual({ group: "producao", "cancel-in-progress": false })
  })

  it("tem os passos de produção na ordem, depois da instalação", () => {
    const ordem = nomes(deploy)
    const i = ordem.indexOf("Instalar dependências")
    expect(i).toBeGreaterThan(-1)
    expect(ordem.slice(i + 1)).toEqual([
      "Base sem a_confirmar",
      "Variáveis na Vercel",
      "Migrações",
      "Deploy",
      "Smoke",
      "Voltar ao deploy anterior",
    ])
  })

  it("a base roda sem continue-on-error nem condição", () => {
    const base = passoNomeado(deploy, "Base sem a_confirmar")
    expect(base.run).toBe("npm run base:check -- --producao")
    expect(base["continue-on-error"]).toBeUndefined()
    expect(base.if).toBeUndefined()
  })

  it("o deploy tem o id deploy", () => {
    expect(passoNomeado(deploy, "Deploy").id).toBe("deploy")
  })

  it("as chamadas do vercel usam a mesma versão fixa, nunca latest", () => {
    const comandos = deploy.steps
      .map((passo) => passo.run ?? "")
      .filter((run) => run.includes("vercel"))
    expect(comandos).toHaveLength(2)
    for (const comando of comandos) {
      expect(comando).toContain(`npx ${VERSAO_VERCEL} `)
      expect(comando).not.toContain("latest")
    }
  })

  it("a volta ao deploy anterior só roda com falha e deploy bem-sucedido", () => {
    const volta = passoNomeado(deploy, "Voltar ao deploy anterior")
    expect(volta.if).toContain("failure()")
    expect(volta.if).toContain("steps.deploy.outcome == 'success'")
  })

  it("os segredos só aparecem no job deploy", () => {
    for (const [nome, job] of Object.entries(ci.jobs)) {
      if (nome === "deploy") continue
      expect(JSON.stringify(job)).not.toContain("secrets.")
    }
    expect(JSON.stringify(deploy)).toContain("secrets.")
  })
})

describe("Dependabot", () => {
  const atualizacoes = dependabot.updates
  const npm = atualizacoes.find((u) => u["package-ecosystem"] === "npm")
  const actions = atualizacoes.find((u) => u["package-ecosystem"] === "github-actions")

  it("versão 2 com os dois ecossistemas", () => {
    expect(dependabot.version).toBe(2)
    expect(npm).toBeDefined()
    expect(actions).toBeDefined()
  })

  it.each([
    ["npm", () => npm],
    ["github-actions", () => actions],
  ])("%s roda toda segunda às 09:00 de São Paulo, com prefixo chore(deps)", (_nome, pegar) => {
    const u = pegar() as Record<string, unknown>
    expect(u.schedule).toEqual({
      interval: "weekly",
      day: "monday",
      time: "09:00",
      timezone: "America/Sao_Paulo",
    })
    expect(u["commit-message"]).toEqual({ prefix: "chore(deps)" })
  })

  it("npm tem limite de 5 PRs abertos e os grupos de OpenTelemetry, produção e desenvolvimento", () => {
    expect(npm?.["open-pull-requests-limit"]).toBe(5)
    expect(Object.keys(npm?.groups as object)[0]).toBe("opentelemetry")
    expect(npm?.groups).toEqual({
      opentelemetry: {
        patterns: ["@opentelemetry/*", "@vercel/otel"],
        "update-types": ["major", "minor", "patch"],
      },
      producao: { "dependency-type": "production", "update-types": ["minor", "patch"] },
      desenvolvimento: { "dependency-type": "development", "update-types": ["minor", "patch"] },
    })
  })
})
