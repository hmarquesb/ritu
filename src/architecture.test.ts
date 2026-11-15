import { readdirSync, readFileSync } from "node:fs"
import { join, posix, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

type SourceFile = { path: string; source: string }
type ImportRecord = { raw: string; typeOnly: boolean }
type ImportCtx = { raw: string; spec: string; typeOnly: boolean }
type FileCtx = { path: string; isTest: boolean; nodes: ts.Node[]; imports: ImportCtx[] }
type Rule = { id: string; check: (file: FileCtx) => string[] }

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SCANNED_DIRS = ["src", "scripts", "evals"]
const SKIPPED_DIRS = new Set(["node_modules", ".next"])
const TEST_FILE = /\.test\.tsx?$/

const CORE_PACKAGES = ["zod"]
const CORE_TEST_PACKAGES = ["vitest"]
const CORE_FORBIDDEN_ALIASES = ["@/infra", "@/app", "@/components"]
const CORE_TEST_ALIASES = ["@/infra/fakes"]
const SCRIPT_ALLOWED_INFRA = ["@/infra/container", "@/infra/env"]
const PACKAGE_HOMES: Record<string, string[]> = {
  postgres: ["src/infra/db/"],
  "@mastra": ["src/infra/mastra/"],
  "@opentelemetry": ["src/infra/otel/", "src/instrumentation.ts"],
  "@vercel/otel": ["src/infra/otel/", "src/instrumentation.ts"],
  "@google/genai": ["src/infra/gemini/"],
  "next-auth": ["src/infra/auth/"],
  "@auth": ["src/infra/auth/"],
}
const PUBLIC_PREFIX = "NEXT_PUBLIC_"
const FORBIDDEN_PUBLIC_WORDS = ["KEY", "SECRET", "TOKEN", "PASSWORD", "DATABASE"]

const isUnder = (spec: string, prefix: string): boolean =>
  spec === prefix || spec.startsWith(`${prefix}/`)
const inDir = (path: string, dir: string): boolean => path.startsWith(`${dir}/`)
const isCore = (path: string): boolean => inDir(path, "src/core")
const present = (values: (string | undefined)[]): string[] =>
  values.filter((value): value is string => value !== undefined)

// Parsing: o TypeScript diz o que é import, sem confundir com comentário ou string.
function parse(path: string, source: string): ts.SourceFile {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
}

function allNodes(root: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [root]
  ts.forEachChild(root, (child) => {
    nodes.push(...allNodes(child))
  })
  return nodes
}

function literalRecord(node: ts.Node | undefined, typeOnly: boolean): ImportRecord | undefined {
  return node && ts.isStringLiteral(node) ? { raw: node.text, typeOnly } : undefined
}

function isTypeOnlyImport(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false
  if (clause.isTypeOnly) return true
  const bindings = clause.namedBindings
  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  )
}

function callRecord(node: ts.CallExpression): ImportRecord | undefined {
  const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"
  return isDynamic || isRequire ? literalRecord(node.arguments[0], false) : undefined
}

function importRecordOf(node: ts.Node): ImportRecord | undefined {
  if (ts.isImportDeclaration(node)) {
    return literalRecord(node.moduleSpecifier, isTypeOnlyImport(node.importClause))
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    return literalRecord(node.moduleSpecifier, node.isTypeOnly)
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return literalRecord(node.moduleReference.expression, node.isTypeOnly)
  }
  if (ts.isCallExpression(node)) return callRecord(node)
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return literalRecord(node.argument.literal, true)
  }
  return undefined
}

// Caminho relativo vira alias (`src/` → `@/`, `config/` → `@config/`) para as regras verem o destino.
function normalizeSpec(path: string, raw: string): string {
  if (!raw.startsWith(".")) return raw
  const resolved = posix.normalize(posix.join(posix.dirname(path), raw))
  if (inDir(resolved, "src")) return `@/${resolved.slice("src/".length)}`
  if (inDir(resolved, "config")) return `@config/${resolved.slice("config/".length)}`
  return resolved
}

function importsIn(path: string, nodes: ts.Node[]): ImportCtx[] {
  return nodes.flatMap((node) => {
    const record = importRecordOf(node)
    return record ? [{ ...record, spec: normalizeSpec(path, record.raw) }] : []
  })
}

function packageName(spec: string): string | undefined {
  if (spec.startsWith(".") || spec.startsWith("@/") || isUnder(spec, "@config")) return undefined
  const [first = spec, second] = spec.split("/")
  return spec.startsWith("@") && second !== undefined ? `${first}/${second}` : first
}

function isForbiddenCoreAlias(spec: string, isTest: boolean): boolean {
  if (isTest && CORE_TEST_ALIASES.some((alias) => isUnder(spec, alias))) return false
  return CORE_FORBIDDEN_ALIASES.some((alias) => isUnder(spec, alias))
}

function isForeignCorePackage(spec: string, isTest: boolean): boolean {
  const pkg = packageName(spec)
  if (pkg === undefined) return false
  const allowed = isTest ? [...CORE_PACKAGES, ...CORE_TEST_PACKAGES] : CORE_PACKAGES
  return !allowed.includes(pkg)
}

function misplacedHomes(path: string, spec: string): string[] | undefined {
  const owner = Object.keys(PACKAGE_HOMES).find((name) => isUnder(spec, name))
  const homes = owner ? PACKAGE_HOMES[owner] : undefined
  if (!homes || homes.some((home) => path.startsWith(home))) return undefined
  return homes
}

const isDateRef = (node: ts.Node): boolean => ts.isIdentifier(node) && node.text === "Date"

function dateDetail(node: ts.Node): string | undefined {
  if (ts.isNewExpression(node) && isDateRef(node.expression) && !node.arguments?.length) {
    return "usa new Date() sem argumento"
  }
  const callee = ts.isCallExpression(node) ? node.expression : undefined
  if (callee && ts.isPropertyAccessExpression(callee)) {
    if (isDateRef(callee.expression) && callee.name.text === "now") return "usa Date.now()"
  }
  return undefined
}

function publicEnvDetail(node: ts.Node): string | undefined {
  if (!ts.isIdentifier(node) && !ts.isStringLiteral(node)) return undefined
  const name = node.text
  const secret =
    name.startsWith(PUBLIC_PREFIX) && FORBIDDEN_PUBLIC_WORDS.some((word) => name.includes(word))
  return secret ? `usa "${name}"` : undefined
}

const importedBy = (file: FileCtx, applies: (ctx: ImportCtx) => boolean): string[] =>
  file.imports.filter(applies).map((ctx) => `importa "${ctx.raw}"`)

const RULE_R1: Rule = {
  id: "R1",
  check: (file) =>
    isCore(file.path)
      ? importedBy(
          file,
          (ctx) =>
            isForbiddenCoreAlias(ctx.spec, file.isTest) ||
            isForeignCorePackage(ctx.spec, file.isTest),
        )
      : [],
}

const RULE_R2: Rule = {
  id: "R2",
  check: (file) =>
    inDir(file.path, "src/infra")
      ? importedBy(file, (ctx) => isUnder(ctx.spec, "@/app") || isUnder(ctx.spec, "@/components"))
      : [],
}

const RULE_R3: Rule = {
  id: "R3",
  check: (file) =>
    inDir(file.path, "src/app")
      ? importedBy(file, (ctx) => isUnder(ctx.spec, "@/infra") && ctx.spec !== "@/infra/container")
      : [],
}

const RULE_R4_COMPONENT_INFRA: Rule = {
  id: "R4",
  check: (file) =>
    inDir(file.path, "src/components")
      ? importedBy(file, (ctx) => isUnder(ctx.spec, "@/infra"))
      : [],
}

const RULE_R4_TYPE_ONLY: Rule = {
  id: "R4",
  check: (file) =>
    inDir(file.path, "src/components")
      ? file.imports
          .filter((ctx) => isUnder(ctx.spec, "@/core") && !ctx.typeOnly)
          .map((ctx) => `importa "${ctx.raw}" sem import type`)
      : [],
}

const RULE_R5: Rule = {
  id: "R5",
  check: (file) =>
    file.imports.flatMap((ctx) => {
      const homes = misplacedHomes(file.path, ctx.spec)
      return homes ? [`importa "${ctx.raw}" fora de ${homes.join(" ou ")}`] : []
    }),
}

const RULE_R6: Rule = {
  id: "R6",
  check: (file) =>
    inDir(file.path, "scripts") || inDir(file.path, "evals")
      ? importedBy(
          file,
          (ctx) =>
            isUnder(ctx.spec, "@/infra") &&
            !SCRIPT_ALLOWED_INFRA.includes(ctx.spec) &&
            !isUnder(ctx.spec, "@/infra/fakes"),
        )
      : [],
}

const RULE_R7: Rule = {
  id: "R7",
  check: (file) => present(file.nodes.map(publicEnvDetail)),
}

const RULE_R8: Rule = {
  id: "R8",
  check: (file) => (isCore(file.path) && !file.isTest ? present(file.nodes.map(dateDetail)) : []),
}

const RULES: Rule[] = [
  RULE_R1,
  RULE_R2,
  RULE_R3,
  RULE_R4_COMPONENT_INFRA,
  RULE_R4_TYPE_ONLY,
  RULE_R5,
  RULE_R6,
  RULE_R7,
  RULE_R8,
]

export function checkFile(path: string, source: string): string[] {
  const nodes = allNodes(parse(path, source))
  const file: FileCtx = {
    path,
    isTest: TEST_FILE.test(path),
    nodes,
    imports: importsIn(path, nodes),
  }
  return RULES.flatMap((rule) => rule.check(file).map((detail) => `${path}: ${rule.id} ${detail}`))
}

// R9: grafo entre domínios (primeira pasta abaixo de src/core/). Arquivos soltos e testes ficam fora.
function domainOf(path: string | undefined): string | undefined {
  const parts = path?.split("/") ?? []
  return parts.length >= 4 && parts[0] === "src" && parts[1] === "core" ? parts[2] : undefined
}

function repoPathOf(spec: string): string | undefined {
  return spec.startsWith("@/") ? `src/${spec.slice("@/".length)}` : undefined
}

type Edge = { from: string; to: string; file: string }

function domainEdges(files: SourceFile[]): Edge[] {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  return sorted.flatMap((file) => {
    const from = domainOf(file.path)
    if (!from || TEST_FILE.test(file.path)) return []
    const nodes = allNodes(parse(file.path, file.source))
    return importsIn(file.path, nodes).flatMap((ctx) => {
      const to = domainOf(repoPathOf(ctx.spec))
      return to && to !== from ? [{ from, to, file: file.path }] : []
    })
  })
}

function buildAdjacency(edges: Edge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const { from, to } of edges) {
    const targets = adjacency.get(from) ?? []
    if (!targets.includes(to)) targets.push(to)
    adjacency.set(from, targets)
  }
  return adjacency
}

function findPath(
  from: string,
  to: string,
  adjacency: Map<string, string[]>,
  seen = new Set<string>(),
): string[] | undefined {
  if (from === to) return [to]
  if (seen.has(from)) return undefined
  seen.add(from)
  for (const next of adjacency.get(from) ?? []) {
    const rest = findPath(next, to, adjacency, seen)
    if (rest) return [from, ...rest]
  }
  return undefined
}

// Mesmo ciclo visto a partir de outro domínio vira a mesma chave.
function canonicalKey(cycle: string[]): string {
  const body = cycle.slice(0, -1)
  const smallest = [...body].sort()[0] ?? ""
  const start = body.indexOf(smallest)
  return [...body.slice(start), ...body.slice(0, start)].join(">")
}

export function findDomainCycles(files: SourceFile[]): string[] {
  const edges = domainEdges(files)
  const adjacency = buildAdjacency(edges)
  const found = new Map<string, string>()
  for (const edge of edges) {
    const back = findPath(edge.to, edge.from, adjacency)
    if (!back) continue
    const cycle = [edge.from, ...back]
    const key = canonicalKey(cycle)
    if (!found.has(key)) found.set(key, `${edge.file}: R9 ciclo ${cycle.join(" → ")}`)
  }
  return [...found.values()]
}

// Varredura do repositório (src, scripts, evals), sem node_modules nem .next.
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function loadRepoFiles(): SourceFile[] {
  return SCANNED_DIRS.flatMap((dir) => listSourceFiles(join(ROOT, dir))).map((abs) => ({
    path: relative(ROOT, abs).split(sep).join("/"),
    source: readFileSync(abs, "utf8"),
  }))
}

// Fixtures montadas em tempo de execução, para o próprio arquivo não cair nas regras.
const IMPORT = "im" + "port"
const REQUIRE = "req" + "uire"
const NEXT_SERVER = ["next", "server"].join("/")
const PUBLIC_VAR = "NEXT_" + "PUBLIC_"
const NEW_DATE = "new " + "Date()"
const NEW_DATE_ARG = "new " + 'Date("2026-01-01")'
const DATE_NOW = "Date" + ".now()"

function expectClean(path: string, source: string): void {
  expect(checkFile(path, source)).toEqual([])
}

function expectOnly(path: string, source: string, rule: string): void {
  const found = checkFile(path, source)
  expect(found).toHaveLength(1)
  expect(found[0]).toContain(`${path}: ${rule} `)
}

describe("R1 · núcleo só importa zod, o próprio core e config", () => {
  it("next/server em src/core gera a violação com a mensagem da tarefa", () => {
    expect(checkFile("src/core/x.ts", `${IMPORT} { NextResponse } from "${NEXT_SERVER}"`)).toEqual([
      'src/core/x.ts: R1 importa "next/server"',
    ])
  })

  it("teste do core pode importar fakes e vitest", () => {
    expectClean(
      "src/core/x.test.ts",
      `${IMPORT} { f } from "@/infra/fakes/fixed-clock"\n${IMPORT} { it } from "vitest"`,
    )
  })

  it("zod e @config são livres no core", () => {
    expectClean(
      "src/core/x.ts",
      `${IMPORT} { z } from "zod"\n${IMPORT} { config } from "@config/index"`,
    )
  })

  it("node:fs no core é violação", () => {
    expectOnly("src/core/x.ts", `${IMPORT} { readFileSync } from "node:fs"`, "R1")
  })

  it("alias de infra no core é violação", () => {
    expectOnly("src/core/x.ts", `${IMPORT} { env } from "@/infra/env"`, "R1")
  })

  it("import relativo que sai do core para infra é violação", () => {
    expectOnly("src/core/a/x.ts", `${IMPORT} { y } from "../../infra/y"`, "R1")
  })

  it("vitest fora de arquivo de teste no core é violação", () => {
    expectOnly("src/core/x.ts", `${IMPORT} { it } from "vitest"`, "R1")
  })

  it("no teste do core, fakes passam mas @/infra/env não", () => {
    expectOnly("src/core/x.test.ts", `${IMPORT} { env } from "@/infra/env"`, "R1")
  })

  it("reexport de pacote proibido também conta", () => {
    expectOnly("src/core/x.ts", `export { x } from "${NEXT_SERVER}"`, "R1")
  })
})

describe("R2 · infra não importa app nem components", () => {
  it("@/app em src/infra é violação", () => {
    expectOnly("src/infra/x.ts", `${IMPORT} { page } from "@/app/page"`, "R2")
  })

  it("@/components em src/infra é violação", () => {
    expectOnly("src/infra/x.ts", `${IMPORT} { b } from "@/components/button"`, "R2")
  })

  it("@/core em src/infra é válido", () => {
    expectClean("src/infra/x.ts", `${IMPORT} { clock } from "@/core/clock"`)
  })
})

describe("R3 · app só importa infra pelo container", () => {
  it("@/infra/env em src/app é violação", () => {
    expectOnly("src/app/page.tsx", `${IMPORT} { env } from "@/infra/env"`, "R3")
  })

  it("@/infra/container em src/app é válido", () => {
    expectClean("src/app/page.tsx", `${IMPORT} { getContainer } from "@/infra/container"`)
  })
})

describe("R4 · components não importa infra nem core sem import type", () => {
  it("@/infra em src/components é violação", () => {
    expectOnly("src/components/x.tsx", `${IMPORT} { env } from "@/infra/env"`, "R4")
  })

  it("import type de core em src/components é válido", () => {
    expectClean("src/components/x.tsx", `${IMPORT} type { Clock } from "@/core/clock"`)
  })

  it("import de core sem type em src/components é violação", () => {
    expectOnly("src/components/x.tsx", `${IMPORT} { Clock } from "@/core/clock"`, "R4")
  })

  it("import { type X } em src/components conta como type", () => {
    expectClean("src/components/x.tsx", `${IMPORT} { type Clock } from "@/core/clock"`)
  })
})

describe("R5 · pacote só na sua pasta", () => {
  it("import() de postgres fora de src/infra/db é violação", () => {
    expectOnly("src/infra/x.ts", `${IMPORT}("postgres")`, "R5")
  })

  it("require() de postgres fora de src/infra/db é violação", () => {
    expectOnly("src/infra/x.ts", `const pg = ${REQUIRE}("postgres")`, "R5")
  })

  it("import() de postgres em src/infra/db/client.ts é válido", () => {
    expectClean("src/infra/db/client.ts", `${IMPORT}("postgres")`)
  })

  it("@mastra fora de src/infra/mastra é violação", () => {
    expectOnly("src/infra/x.ts", `${IMPORT} { Agent } from "@mastra/core/agent"`, "R5")
  })

  it("@opentelemetry em src/instrumentation.ts é válido", () => {
    expectClean("src/instrumentation.ts", `${IMPORT} { trace } from "@opentelemetry/api"`)
  })

  it("@google/genai só em src/infra/gemini", () => {
    expectClean("src/infra/gemini/client.ts", `${IMPORT} { GoogleGenAI } from "@google/genai"`)
    expectOnly("src/app/x.ts", `${IMPORT} { GoogleGenAI } from "@google/genai"`, "R5")
  })
})

describe("R6 · scripts e evals só usam o container, env e fakes", () => {
  it("@/infra/db em scripts é violação", () => {
    expectOnly("scripts/x.ts", `${IMPORT} { db } from "@/infra/db/client"`, "R6")
  })

  it("relativo que chega a infra em scripts é violação", () => {
    expectOnly("scripts/x.ts", `${IMPORT} { db } from "../src/infra/db/client"`, "R6")
  })

  it("env, container e fakes são válidos em scripts e evals", () => {
    expectClean("scripts/x.ts", `${IMPORT} { envStatus } from "@/infra/env"`)
    expectClean("scripts/x.ts", `${IMPORT} { getContainer } from "@/infra/container"`)
    expectClean("evals/x.ts", `${IMPORT} { f } from "@/infra/fakes/fixed-clock"`)
  })
})

describe("R7 · variável NEXT_PUBLIC sem segredo no nome", () => {
  it("variável pública com KEY no nome é violação", () => {
    expectOnly("src/app/x.tsx", `const k = process.env.${PUBLIC_VAR}API_KEY`, "R7")
  })

  it("variável pública com DATABASE no nome é violação", () => {
    expectOnly("src/app/x.tsx", `const u = process.env.${PUBLIC_VAR}DATABASE_URL`, "R7")
  })

  it("variável pública sem segredo no nome é válida", () => {
    expectClean("src/app/x.tsx", `const s = process.env.${PUBLIC_VAR}SITE_URL`)
  })
})

describe("R8 · sem relógio real no core", () => {
  it("new Date() sem argumento no core é violação", () => {
    expectOnly("src/core/x.ts", `const now = ${NEW_DATE}`, "R8")
  })

  it("Date.now() no core é violação", () => {
    expectOnly("src/core/x.ts", `const t = ${DATE_NOW}`, "R8")
  })

  it("new Date com data é válido no core", () => {
    expectClean("src/core/x.ts", `const d = ${NEW_DATE_ARG}`)
  })

  it("Date.now() em teste do core é válido", () => {
    expectClean("src/core/x.test.ts", `const t = ${DATE_NOW}`)
  })

  it("new Date() fora do core é válido", () => {
    expectClean("src/infra/system-clock.ts", `const now = ${NEW_DATE}`)
  })
})

describe("comentários e strings não geram violação", () => {
  it("import proibido dentro de comentário é válido", () => {
    expectClean("src/core/x.ts", `// ${IMPORT} { NextResponse } from "${NEXT_SERVER}"`)
    expectClean("src/core/x.ts", `/* ${IMPORT} "${NEXT_SERVER}" */ export const a = 1`)
  })

  it("import proibido dentro de string comum é válido", () => {
    expectClean("src/core/x.ts", `export const text = 'import "${NEXT_SERVER}"'`)
  })

  it("variável proibida dentro de comentário é válida", () => {
    expectClean("src/app/x.tsx", `// process.env.${PUBLIC_VAR}API_KEY`)
  })
})

describe("varredura do repositório", () => {
  it("src, scripts e evals não têm nenhuma violação", () => {
    const files = loadRepoFiles()
    expect(files.length).toBeGreaterThan(0)
    const violations = [
      ...files.flatMap((file) => checkFile(file.path, file.source)),
      ...findDomainCycles(files),
    ]
    expect(violations).toEqual([])
  })
})

describe("R9 · sem ciclo entre domínios do core", () => {
  const file = (path: string, source: string): SourceFile => ({ path, source })

  it("a → b → a gera a violação com o ciclo", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.ts", `${IMPORT} { y } from "@/core/b/y"`),
        file("src/core/b/y.ts", `${IMPORT} { x } from "@/core/a/x"`),
      ]),
    ).toEqual(["src/core/a/x.ts: R9 ciclo a → b → a"])
  })

  it("ciclo com imports relativos também é detectado", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.ts", `${IMPORT} { y } from "../b/y"`),
        file("src/core/b/y.ts", `${IMPORT} { x } from "../a/x"`),
      ]),
    ).toEqual(["src/core/a/x.ts: R9 ciclo a → b → a"])
  })

  it("ciclo de três domínios mostra o caminho completo", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.ts", `${IMPORT} { y } from "@/core/b/y"`),
        file("src/core/b/y.ts", `${IMPORT} { z } from "@/core/c/z"`),
        file("src/core/c/z.ts", `${IMPORT} { x } from "@/core/a/x"`),
      ]),
    ).toEqual(["src/core/a/x.ts: R9 ciclo a → b → c → a"])
  })

  it("arquivo solto em src/core não forma ciclo", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.ts", `${IMPORT} { e } from "@/core/errors"`),
        file("src/core/b/y.ts", `${IMPORT} { e } from "@/core/errors"`),
        file("src/core/errors.ts", `${IMPORT} { x } from "@/core/a/x"`),
      ]),
    ).toEqual([])
  })

  it("dependência em um só sentido não é ciclo", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.ts", `${IMPORT} { y } from "@/core/b/y"`),
        file("src/core/b/y.ts", `export const y = 1`),
      ]),
    ).toEqual([])
  })

  it("arquivo de teste fica fora do grafo", () => {
    expect(
      findDomainCycles([
        file("src/core/a/x.test.ts", `${IMPORT} { y } from "@/core/b/y"`),
        file("src/core/b/y.ts", `${IMPORT} { x } from "@/core/a/x.test"`),
      ]),
    ).toEqual([])
  })
})
