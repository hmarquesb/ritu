import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type Checagem,
  checarHeaders,
  checarPagina,
  checarProtecao,
  checarPublico,
  checarSaude,
  ultimaMigracao,
  versaoChegou,
} from "./smoke"

const HTML_FIXTURE =
  "<html><body><h1>Ritu</h1><p>Projeto de estudo. Não é orientação médica.</p><script>var segredo='x'</script></body></html>"

const CSP_FIXTURE =
  "default-src 'self'; script-src 'self' 'nonce-abc123XYZ' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'"

const SAUDE_OK = {
  versao: "1.4.0",
  ambiente: "production",
  banco: "ok",
  migracao: "0004_lista_motivo_pessoa.sql",
  base: { alimentos: 120, preparos: 40, praticas: 25 },
  seed: "ok",
  telemetria: true,
  google: true,
}

const ESPERADO = { versao: "1.4.0", ultimaMigracao: "0004_lista_motivo_pessoa.sql" }

function headersOk(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "content-security-policy": CSP_FIXTURE,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    ...extra,
  })
}

function porNome(checagens: Checagem[], nome: string): Checagem {
  const achada = checagens.find((c) => c.nome === nome)
  if (!achada) throw new Error(`checagem ausente: ${nome}`)
  return achada
}

function todosDetalhes(checagens: Checagem[]): string {
  return checagens.map((c) => `${c.nome} ${c.detalhe}`).join("\n")
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("checarSaude", () => {
  it("passa tudo com o corpo esperado", () => {
    const checagens = checarSaude(SAUDE_OK, ESPERADO)
    expect(checagens.every((c) => c.ok)).toBe(true)
    expect(checagens.map((c) => c.grupo)).toContain("saude")
    expect(checagens.map((c) => c.grupo)).toContain("versao")
  })

  it("falha quando o banco não está ok", () => {
    const checagens = checarSaude({ ...SAUDE_OK, banco: "falhou" }, ESPERADO)
    expect(porNome(checagens, "banco").ok).toBe(false)
  })

  it("falha quando o seed falhou", () => {
    const checagens = checarSaude({ ...SAUDE_OK, seed: "falhou" }, ESPERADO)
    expect(porNome(checagens, "seed").ok).toBe(false)
  })

  it("falha quando alguma contagem da base é zero", () => {
    const checagens = checarSaude(
      { ...SAUDE_OK, base: { alimentos: 120, preparos: 0, praticas: 25 } },
      ESPERADO,
    )
    expect(porNome(checagens, "base").ok).toBe(false)
  })

  it("passa com a base toda acima de zero", () => {
    expect(porNome(checarSaude(SAUDE_OK, ESPERADO), "base").ok).toBe(true)
  })

  it("falha quando a migração não é a última esperada", () => {
    const checagens = checarSaude({ ...SAUDE_OK, migracao: "0003_limites.sql" }, ESPERADO)
    expect(porNome(checagens, "migracao").ok).toBe(false)
  })

  it("falha quando telemetria ou google estão desligados", () => {
    expect(
      porNome(checarSaude({ ...SAUDE_OK, telemetria: false }, ESPERADO), "telemetria").ok,
    ).toBe(false)
    expect(porNome(checarSaude({ ...SAUDE_OK, google: false }, ESPERADO), "google").ok).toBe(false)
  })

  it("falha quando o ambiente não é production", () => {
    const checagens = checarSaude({ ...SAUDE_OK, ambiente: "preview" }, ESPERADO)
    expect(porNome(checagens, "ambiente").ok).toBe(false)
  })

  it("falha a checagem de versão quando a versão difere", () => {
    const checagens = checarSaude({ ...SAUDE_OK, versao: "1.3.0" }, ESPERADO)
    expect(checagens.find((c) => c.grupo === "versao")?.ok).toBe(false)
  })

  it("não checa versão quando a versão esperada não é informada", () => {
    const checagens = checarSaude(SAUDE_OK, { ultimaMigracao: ESPERADO.ultimaMigracao })
    expect(checagens.some((c) => c.grupo === "versao")).toBe(false)
  })

  it("corpo com formato errado vira uma checagem 'formato' falha", () => {
    const checagens = checarSaude({ banco: "ok", qualquer: 1 }, ESPERADO)
    const formato = porNome(checagens, "formato")
    expect(formato.ok).toBe(false)
    expect(formato.grupo).toBe("saude")
  })

  it("corpo nulo ou texto também cai no formato", () => {
    expect(porNome(checarSaude(null, ESPERADO), "formato").ok).toBe(false)
    expect(porNome(checarSaude("oi", ESPERADO), "formato").ok).toBe(false)
  })
})

describe("checarPagina", () => {
  it("passa com status 200 e o aviso no HTML", () => {
    const checagens = checarPagina(200, HTML_FIXTURE)
    expect(checagens.every((c) => c.ok)).toBe(true)
  })

  it("falha com status diferente de 200", () => {
    const checagens = checarPagina(503, HTML_FIXTURE)
    expect(porNome(checagens, "status").ok).toBe(false)
    expect(porNome(checagens, "status").detalhe).toContain("503")
  })

  it("falha quando o aviso de orientação médica não aparece", () => {
    const checagens = checarPagina(200, "<html><body>Ritu</body></html>")
    expect(porNome(checagens, "aviso").ok).toBe(false)
  })

  it("nenhum detalhe traz o HTML da resposta", () => {
    const checagens = checarPagina(200, HTML_FIXTURE)
    expect(todosDetalhes(checagens)).not.toContain(HTML_FIXTURE)
    expect(todosDetalhes(checagens)).not.toContain("segredo")
  })
})

describe("checarHeaders", () => {
  it("passa com os headers esperados", () => {
    const checagens = checarHeaders(headersOk())
    expect(checagens.every((c) => c.ok)).toBe(true)
    expect(checagens.every((c) => c.grupo === "headers")).toBe(true)
  })

  it("falha quando a CSP não tem nonce", () => {
    const checagens = checarHeaders(
      headersOk({ "content-security-policy": "script-src 'self'; frame-ancestors 'none'" }),
    )
    expect(porNome(checagens, "CSP nonce").ok).toBe(false)
  })

  it("falha quando a CSP não tem frame-ancestors 'none'", () => {
    const checagens = checarHeaders(
      headersOk({ "content-security-policy": "script-src 'self' 'nonce-abc'" }),
    )
    expect(porNome(checagens, "CSP frame-ancestors").ok).toBe(false)
  })

  it("passa com 'unsafe-inline' em style-src", () => {
    const checagens = checarHeaders(
      headersOk({
        "content-security-policy":
          "script-src 'self' 'nonce-abc'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
      }),
    )
    expect(porNome(checagens, "CSP script-src sem unsafe-inline").ok).toBe(true)
  })

  it("falha com 'unsafe-inline' em script-src", () => {
    const checagens = checarHeaders(
      headersOk({
        "content-security-policy":
          "script-src 'self' 'unsafe-inline' 'nonce-abc'; frame-ancestors 'none'",
      }),
    )
    expect(porNome(checagens, "CSP script-src sem unsafe-inline").ok).toBe(false)
  })

  it("usa default-src quando script-src não aparece", () => {
    const ok = checarHeaders(
      headersOk({
        "content-security-policy": "default-src 'self' 'nonce-abc'; frame-ancestors 'none'",
      }),
    )
    expect(porNome(ok, "CSP script-src sem unsafe-inline").ok).toBe(true)

    const ruim = checarHeaders(
      headersOk({
        "content-security-policy":
          "default-src 'self' 'unsafe-inline' 'nonce-abc'; frame-ancestors 'none'",
      }),
    )
    expect(porNome(ruim, "CSP script-src sem unsafe-inline").ok).toBe(false)
  })

  it("falha sem CSP", () => {
    const h = headersOk()
    h.delete("content-security-policy")
    const checagens = checarHeaders(h)
    expect(checagens.filter((c) => c.nome.startsWith("CSP")).every((c) => !c.ok)).toBe(true)
  })

  it("falha sem nosniff", () => {
    const checagens = checarHeaders(headersOk({ "x-content-type-options": "" }))
    expect(porNome(checagens, "x-content-type-options").ok).toBe(false)
  })

  it("falha com outro referrer-policy", () => {
    const checagens = checarHeaders(headersOk({ "referrer-policy": "no-referrer" }))
    expect(porNome(checagens, "referrer-policy").ok).toBe(false)
  })

  it("falha quando permissions-policy não desliga câmera, microfone e geolocalização", () => {
    const checagens = checarHeaders(headersOk({ "permissions-policy": "camera=(self)" }))
    expect(porNome(checagens, "permissions-policy").ok).toBe(false)
  })

  it("falha com HSTS max-age=600", () => {
    const checagens = checarHeaders(headersOk({ "strict-transport-security": "max-age=600" }))
    expect(porNome(checagens, "strict-transport-security").ok).toBe(false)
  })

  it("passa com HSTS de um ano ou mais", () => {
    const checagens = checarHeaders(headersOk({ "strict-transport-security": "max-age=31536000" }))
    expect(porNome(checagens, "strict-transport-security").ok).toBe(true)
  })

  it("nenhum detalhe traz a CSP inteira nem o valor recebido", () => {
    const checagens = checarHeaders(
      headersOk({
        "content-security-policy": "script-src 'self' 'unsafe-inline'; object-src 'none'",
      }),
    )
    const texto = todosDetalhes(checagens)
    expect(texto).not.toContain("script-src 'self' 'unsafe-inline'; object-src 'none'")
    expect(texto).not.toContain(CSP_FIXTURE)
    expect(texto).not.toContain("max-age=63072000")
  })
})

describe("checarProtecao", () => {
  it("passa com 401 sem bearer e 403 sem origin", () => {
    const checagens = checarProtecao({ cronSemBearer: 401, postSemOrigin: 403 })
    expect(checagens.every((c) => c.ok)).toBe(true)
    expect(checagens.every((c) => c.grupo === "protecao")).toBe(true)
  })

  it("falha quando o cron responde outra coisa que 401 sem bearer", () => {
    const checagens = checarProtecao({ cronSemBearer: 200, postSemOrigin: 403 })
    expect(porNome(checagens, "cron sem bearer").ok).toBe(false)
  })

  it("falha quando o POST sem origin não responde 403", () => {
    const checagens = checarProtecao({ cronSemBearer: 401, postSemOrigin: 201 })
    expect(porNome(checagens, "post sem origin").ok).toBe(false)
  })
})

describe("ultimaMigracao", () => {
  it("devolve o maior nome .sql, com a extensão como o migrate grava", () => {
    expect(
      ultimaMigracao([
        "0002_llm_uso.sql",
        "0004_lista_motivo_pessoa.sql",
        "0001_inicial.sql",
        "0003_limites.sql",
      ]),
    ).toBe("0004_lista_motivo_pessoa.sql")
  })

  it("ignora arquivos que não são .sql", () => {
    expect(ultimaMigracao(["0001_inicial.sql", "LEIAME.md", "0009_rascunho.txt"])).toBe(
      "0001_inicial.sql",
    )
  })

  it("devolve texto vazio quando não há migração", () => {
    expect(ultimaMigracao([])).toBe("")
  })
})

describe("checarPublico", () => {
  const SEIS_TOOLS = [
    "ayurveda_alimento",
    "ayurveda_candidatos",
    "ayurveda_substitutos",
    "ayurveda_checar_combinacao",
    "clima_agora",
    "clima_proximas_horas",
  ]

  it("passa com 200 e as seis tools, em qualquer ordem", () => {
    const checagens = checarPublico({
      bastidores: 200,
      toolsDoMcp: [...SEIS_TOOLS].reverse(),
    })
    expect(checagens.every((c) => c.ok)).toBe(true)
    expect(checagens.every((c) => c.grupo === "publico")).toBe(true)
  })

  it("falha quando /bastidores não responde 200", () => {
    const checagens = checarPublico({ bastidores: 500, toolsDoMcp: SEIS_TOOLS })
    expect(porNome(checagens, "bastidores").ok).toBe(false)
  })

  it("falha com o nome da tool que falta", () => {
    const checagens = checarPublico({
      bastidores: 200,
      toolsDoMcp: SEIS_TOOLS.filter((t) => t !== "clima_agora"),
    })
    const tools = porNome(checagens, "mcp tools/list")
    expect(tools.ok).toBe(false)
    expect(tools.detalhe).toContain("clima_agora")
  })
})

describe("versaoChegou", () => {
  it("é verdadeiro quando a versão do corpo é a esperada", () => {
    expect(versaoChegou({ versao: "1.4.0" }, "1.4.0")).toBe(true)
  })

  it("é falso para outra versão, versão nula ou corpo fora do formato", () => {
    expect(versaoChegou({ versao: "1.3.0" }, "1.4.0")).toBe(false)
    expect(versaoChegou({ versao: null }, "1.4.0")).toBe(false)
    expect(versaoChegou(undefined, "1.4.0")).toBe(false)
    expect(versaoChegou("1.4.0", "1.4.0")).toBe(false)
  })
})

describe("funções puras", () => {
  it("nenhuma função faz pedido de rede", () => {
    const fetchEspiao = vi.fn()
    vi.stubGlobal("fetch", fetchEspiao)

    checarSaude(SAUDE_OK, ESPERADO)
    checarPagina(200, HTML_FIXTURE)
    checarHeaders(headersOk())
    checarProtecao({ cronSemBearer: 401, postSemOrigin: 403 })
    ultimaMigracao(["0001_inicial.sql"])
    versaoChegou(SAUDE_OK, "1.4.0")

    expect(fetchEspiao).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
