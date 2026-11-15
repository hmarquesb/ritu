import { config } from "@config/index"
import { checarCombinacao } from "@/core/knowledge/combinacoes"
import { passaNoFiltro, serveAVaga } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Alimento, Pratica, Preparo } from "@/core/knowledge/schemas"
import { type SinaisPessoa, substitutos } from "@/core/knowledge/substitutos"
import { type Guna, OPOSTO } from "@/core/knowledge/vocab"
import type { DadosDoPreparo } from "./preparo"
import type { EntregaDoModelo } from "./saida"

export type CodigoDeViolacao =
  | "fora_da_base"
  | "estrutura"
  | "fora_de_casa"
  | "evitar_sempre"
  | "restricao"
  | "nao_come"
  | "nao_gosta"
  | "contraindicacao"
  | "combinacao"
  | "repetida"
  | "linha_base"
  | "qualidades"
  | "novidade"
  | "para_ter"
  | "texto_sem_estrutura"
  | "tamanho"
  | "vazia"

export type Violacao = { codigo: CodigoDeViolacao; onde: string; mensagem: string }

type Parametros = {
  dados: DadosDoPreparo
  clima?: { gunas: Guna[] }
  kb: KnowledgeBase
  sinais: SinaisPessoa
}

type Sugestao = EntregaDoModelo["sugestoes"][number]
type Item = Sugestao["itens"][number]
type Alvo = { pratica?: Pratica; preparo?: Preparo }

type Ctx = Parametros & {
  entrega: EntregaDoModelo
  violacoes: Violacao[]
  chaves: Set<string>
}

const LIMITE_DE_SUBSTITUTOS = 100

function apontar(ctx: Ctx, codigo: CodigoDeViolacao, onde: string, mensagem: string): void {
  const chave = `${codigo}|${onde}|${mensagem}`
  if (ctx.chaves.has(chave)) return
  ctx.chaves.add(chave)
  ctx.violacoes.push({ codigo, onde, mensagem })
}

const intersecao = <T>(a: readonly T[], b: readonly T[]): T[] => a.filter((x) => b.includes(x))

function linhaDaSugestao(s: Sugestao): string | undefined {
  if (s.pratica_id !== undefined && s.preparo_id === undefined) return `praticas:${s.pratica_id}`
  if (s.preparo_id !== undefined && s.pratica_id === undefined) return `preparos:${s.preparo_id}`
  return undefined
}

// Resolve a prática ou o preparo da sugestão; aponta fora_da_base e devolve undefined se não der.
function resolverAlvo(ctx: Ctx, s: Sugestao, onde: string): Alvo | undefined {
  const { kb } = ctx
  if ((s.pratica_id === undefined) === (s.preparo_id === undefined)) {
    apontar(
      ctx,
      "fora_da_base",
      onde,
      "informe exatamente um entre pratica_id (chá, óleo, prática) e preparo_id (refeição), nunca os dois nem nenhum",
    )
    return undefined
  }
  if (s.preparo_id !== undefined) {
    const preparo = kb.preparo(s.preparo_id)
    if (!preparo || s.tipo !== "refeicao") {
      apontar(
        ctx,
        "fora_da_base",
        onde,
        `preparo ${s.preparo_id} não existe ou o tipo não é refeicao`,
      )
      return undefined
    }
    return { preparo }
  }
  const pratica = kb.pratica(s.pratica_id ?? "")
  if (!pratica || pratica.tipo !== s.tipo) {
    apontar(ctx, "fora_da_base", onde, `prática ${s.pratica_id} não existe ou o tipo não bate`)
    return undefined
  }
  return { pratica }
}

function checarEstruturaDaPratica(ctx: Ctx, s: Sugestao, pratica: Pratica, onde: string): void {
  const itens = new Set(s.itens.map((i) => i.alimento_id))
  const iguais =
    itens.size === s.itens.length &&
    itens.size === pratica.ingredientes.length &&
    pratica.ingredientes.every((id) => itens.has(id))
  if (iguais) return
  const esperado =
    pratica.ingredientes.length === 0
      ? "deixe itens vazio, a prática não tem ingredientes"
      : `os itens devem ser exatamente ${pratica.ingredientes.join(", ")}`
  apontar(ctx, "estrutura", onde, `${pratica.id}: ${esperado}`)
}

function checarItemDaRefeicao(ctx: Ctx, preparo: Preparo, item: Item, onde: string): void {
  const vaga = preparo.vagas.find((v) => v.funcao === item.funcao)
  const alimento = ctx.kb.alimento(item.alimento_id)
  if (!vaga || !alimento) {
    apontar(ctx, "estrutura", onde, `${item.alimento_id} não ocupa uma vaga de ${preparo.id}`)
    return
  }
  if (!serveAVaga(alimento, vaga)) {
    apontar(ctx, "estrutura", onde, `${item.alimento_id} não serve à vaga ${vaga.funcao}`)
  }
}

function checarVagasDaRefeicao(ctx: Ctx, s: Sugestao, preparo: Preparo, onde: string): void {
  for (const vaga of preparo.vagas) {
    const total = s.itens.filter((i) => i.funcao === vaga.funcao).length
    if (vaga.obrigatoria && total === 0) {
      apontar(
        ctx,
        "estrutura",
        onde,
        `falta item para a vaga obrigatória ${vaga.funcao}: preencha com um alimento confirmado em casa ou escolha outro candidato`,
      )
    }
    if (total > vaga.maximo) {
      apontar(ctx, "estrutura", onde, `a vaga ${vaga.funcao} aceita no máximo ${vaga.maximo} item`)
    }
  }
}

function checarEstrutura(ctx: Ctx, s: Sugestao, alvo: Alvo, onde: string): void {
  if (alvo.pratica) checarEstruturaDaPratica(ctx, s, alvo.pratica, onde)
  if (!alvo.preparo) return
  checarVagasDaRefeicao(ctx, s, alvo.preparo, onde)
  s.itens.forEach((item, i) => {
    checarItemDaRefeicao(ctx, alvo.preparo as Preparo, item, `${onde}.itens[${i}]`)
  })
}

function checarFiltroDoAlimento(ctx: Ctx, id: string, onde: string): boolean {
  const alimento = ctx.kb.alimento(id)
  if (!alimento) return true
  const r = passaNoFiltro(alimento, ctx.dados.filtro, ctx.kb)
  if (r.passa || !r.motivo) return true
  apontar(ctx, r.motivo, onde, `${id} não pode aparecer: a pessoa pediu para evitar`)
  return false
}

function checarContraindicacao(ctx: Ctx, alvo: Alvo, onde: string): void {
  const { estados } = ctx.dados
  const base = alvo.pratica ?? alvo.preparo
  if (!base) return
  const estado = intersecao(base.contraindicacoes, estados)[0]
  if (estado)
    apontar(ctx, "contraindicacao", onde, `${base.id} é contraindicado no estado ${estado}`)
  const restricao = alvo.pratica
    ? intersecao(alvo.pratica.nunca_sugerir_se, ctx.dados.filtro.restricoes)[0]
    : undefined
  if (restricao)
    apontar(ctx, "contraindicacao", onde, `${base.id} nunca é sugerido com ${restricao}`)
}

function checarMarcas(ctx: Ctx, alimento: Alimento, onde: string): void {
  const marca = intersecao(alimento.marcas, ctx.dados.qualidades.evitar_marcas)[0]
  if (marca)
    apontar(ctx, "contraindicacao", onde, `${alimento.id} tem a marca ${marca}, a evitar agora`)
}

function checarSeFaltar(ctx: Ctx, s: Sugestao, item: Item, onde: string): void {
  const troca = item.se_faltar
  if (troca === undefined) return
  const alvo = `${onde}.se_faltar`
  if (!ctx.kb.alimento(troca)) {
    apontar(ctx, "fora_da_base", alvo, `${troca} não existe na base`)
    return
  }
  if (!checarFiltroDoAlimento(ctx, troca, alvo)) return
  const opcoes = substitutos(
    {
      alimento_id: item.alimento_id,
      ...(item.funcao ? { funcao: item.funcao } : {}),
      ...(s.preparo_id ? { preparo_id: s.preparo_id } : {}),
      outros_itens: s.itens.map((i) => i.alimento_id).filter((id) => id !== item.alimento_id),
      filtro: ctx.dados.filtro,
      sinais: ctx.sinais,
      limite: LIMITE_DE_SUBSTITUTOS,
    },
    ctx.kb,
  )
  const valido =
    ctx.dados.casa.confirmados.includes(troca) && opcoes.some((o) => o.alimento_id === troca)
  if (!valido) {
    apontar(
      ctx,
      "fora_de_casa",
      alvo,
      `${troca} não está confirmado em casa ou não troca ${item.alimento_id}`,
    )
  }
}

function checarCasa(ctx: Ctx, item: Item, onde: string): void {
  const { confirmados, incertos } = ctx.dados.casa
  if (confirmados.includes(item.alimento_id)) return
  if (incertos.includes(item.alimento_id)) {
    if (item.se_faltar === undefined) {
      apontar(ctx, "fora_de_casa", onde, `${item.alimento_id} está incerto: preencha se_faltar`)
    }
    return
  }
  apontar(
    ctx,
    "fora_de_casa",
    onde,
    `${item.alimento_id} não está confirmado em casa: tire da sugestão ou escolha outro candidato`,
  )
}

function checarQualidadesDoItem(ctx: Ctx, item: Item, alimento: Alimento, onde: string): void {
  const buscadas = ctx.entrega.explicacao.qualidades_buscadas
  const fora = item.contribui.find((g) => !alimento.gunas.includes(g) || !buscadas.includes(g))
  if (fora) {
    apontar(
      ctx,
      "qualidades",
      onde,
      `${item.alimento_id} não contribui com ${fora} para o que se busca`,
    )
  }
}

function checarLinhaDoItem(ctx: Ctx, item: Item, onde: string): void {
  if (item.linha_base !== `alimentos:${item.alimento_id}`) {
    apontar(
      ctx,
      "linha_base",
      onde,
      `a linha_base de ${item.alimento_id} deve ser alimentos:${item.alimento_id}`,
    )
  }
}

function checarItem(ctx: Ctx, s: Sugestao, item: Item, onde: string): void {
  const alimento = ctx.kb.alimento(item.alimento_id)
  if (!alimento) {
    apontar(ctx, "fora_da_base", onde, `${item.alimento_id} não existe na base`)
    return
  }
  checarCasa(ctx, item, onde)
  checarFiltroDoAlimento(ctx, item.alimento_id, onde)
  checarMarcas(ctx, alimento, onde)
  checarSeFaltar(ctx, s, item, onde)
  checarLinhaDoItem(ctx, item, onde)
  checarQualidadesDoItem(ctx, item, alimento, onde)
}

function checarLinhasDaSugestao(ctx: Ctx, s: Sugestao, onde: string): void {
  const propria = linhaDaSugestao(s)
  const ruim = s.linhas_base.find((l) => ctx.kb.linha(l) === undefined)
  if (s.linhas_base.length === 0 || ruim !== undefined) {
    apontar(
      ctx,
      "linha_base",
      onde,
      `linhas_base vazio ou com linha inexistente${ruim ? `: ${ruim}` : ""}`,
    )
  } else if (propria && !s.linhas_base.includes(propria)) {
    apontar(ctx, "linha_base", onde, `linhas_base deve conter ${propria}`)
  }
  if (s.motivo.trim() === "") apontar(ctx, "linha_base", onde, "motivo vazio")
}

function checarRepeticao(ctx: Ctx, s: Sugestao, onde: string): void {
  const linha = linhaDaSugestao(s)
  if (!linha) return
  const vezesNaEntrega = ctx.entrega.sugestoes.filter((o) => linhaDaSugestao(o) === linha).length
  if (ctx.dados.sugeridos_hoje.includes(linha) || vezesNaEntrega > 1) {
    apontar(ctx, "repetida", onde, `${linha} já foi sugerida hoje ou aparece duas vezes`)
  }
}

function checarNovidade(ctx: Ctx, s: Sugestao, onde: string): void {
  if (!s.novidade) return
  const id = s.pratica_id ?? s.preparo_id
  const marcado = ctx.dados.candidatos.some((c) => c.novidade && c.tipo === s.tipo && c.id === id)
  if (!marcado) apontar(ctx, "novidade", onde, `${id} não veio marcado como novidade`)
}

function checarCombinacaoDaSugestao(ctx: Ctx, s: Sugestao, onde: string): void {
  const ids = s.itens.map((i) => i.alimento_id)
  const { compativel, conflitos } = checarCombinacao(ids, ctx.kb)
  if (compativel) return
  const par = conflitos[0]?.itens.join(" e ") ?? ""
  apontar(ctx, "combinacao", onde, `combinação incompatível entre ${par}`)
}

function checarSugestao(ctx: Ctx, s: Sugestao, i: number): void {
  const onde = `sugestoes[${i}]`
  checarLinhasDaSugestao(ctx, s, onde)
  checarRepeticao(ctx, s, onde)
  checarNovidade(ctx, s, onde)
  const alvo = resolverAlvo(ctx, s, onde)
  if (alvo) {
    checarEstrutura(ctx, s, alvo, onde)
    checarContraindicacao(ctx, alvo, onde)
  }
  checarCombinacaoDaSugestao(ctx, s, onde)
  s.itens.forEach((item, j) => {
    checarItem(ctx, s, item, `${onde}.itens[${j}]`)
  })
}

function checarQualidadesGerais(ctx: Ctx): void {
  const { qualidades } = ctx.dados
  const clima = ctx.clima?.gunas ?? []
  const permitidasDoMomento = [...qualidades.presentes, ...clima]
  const permitidasBuscadas = [...qualidades.buscadas, ...clima.map((g) => OPOSTO[g])]
  const { qualidades_do_momento: momento, qualidades_buscadas: buscadas } = ctx.entrega.explicacao
  const foraMomento = momento.find((g) => !permitidasDoMomento.includes(g))
  if (foraMomento) {
    apontar(
      ctx,
      "qualidades",
      "explicacao.qualidades_do_momento",
      `${foraMomento} não é do momento; use só: ${permitidasDoMomento.join(", ") || "nenhuma"}`,
    )
  }
  const foraBuscada = buscadas.find((g) => !permitidasBuscadas.includes(g))
  if (foraBuscada) {
    apontar(
      ctx,
      "qualidades",
      "explicacao.qualidades_buscadas",
      `${foraBuscada} não é buscada agora; use só: ${permitidasBuscadas.join(", ") || "nenhuma"}`,
    )
  }
}

function checarEvitar(ctx: Ctx): void {
  const permitidas = ctx.dados.qualidades.evitar.map((e) => e.linha_base)
  ctx.entrega.evitar.forEach((linha, i) => {
    if (!permitidas.includes(linha)) {
      apontar(
        ctx,
        "linha_base",
        `evitar[${i}]`,
        `${linha} não está entre as linhas de evitar do momento; copie o linha_base de qualidades.evitar do contexto (${permitidas.join(", ") || "nenhuma: deixe evitar vazio"})`,
      )
    }
  })
}

// Alimentos que uma linha citada traz (o próprio alimento ou os ingredientes da prática).
function alimentosDaLinha(kb: KnowledgeBase, linha: string): string[] {
  const [tabela, id = ""] = linha.split(":")
  if (tabela === "alimentos") return [id]
  if (tabela === "praticas") return kb.pratica(id)?.ingredientes ?? []
  return []
}

function checarCitados(ctx: Ctx): void {
  ctx.entrega.citados.forEach((linha, i) => {
    const onde = `citados[${i}]`
    if (ctx.kb.linha(linha) === undefined) {
      const dica = linha.includes(":")
        ? ""
        : `; cite como tabela:id, por exemplo alimentos:${linha} ou praticas:${linha}`
      apontar(ctx, "fora_da_base", onde, `${linha} não existe na base${dica}`)
      return
    }
    for (const id of alimentosDaLinha(ctx.kb, linha)) checarFiltroDoAlimento(ctx, id, onde)
  })
}

function checarParaTer(ctx: Ctx): void {
  const pt = ctx.entrega.para_ter
  if (!pt) return
  const esperado = ctx.dados.para_ter
  if (!esperado) {
    apontar(ctx, "para_ter", "para_ter", "o contexto não trouxe para_ter: tire o campo")
    return
  }
  if (pt.alimento_id !== esperado.alimento_id || pt.vezes !== esperado.vezes) {
    apontar(
      ctx,
      "para_ter",
      "para_ter",
      `para_ter deve ser ${esperado.alimento_id} com ${esperado.vezes} vezes`,
    )
  }
  if (pt.linha_base !== esperado.linha_base) {
    apontar(ctx, "para_ter", "para_ter", `a linha_base de para_ter deve ser ${esperado.linha_base}`)
  }
  checarFiltroDoAlimento(ctx, pt.alimento_id, "para_ter")
}

function idsEstruturados(entrega: EntregaDoModelo, kb: KnowledgeBase): Set<string> {
  const ids = new Set<string>()
  for (const s of entrega.sugestoes) {
    if (s.pratica_id) ids.add(`praticas:${s.pratica_id}`)
    for (const i of s.itens) {
      ids.add(`alimentos:${i.alimento_id}`)
      if (i.se_faltar) ids.add(`alimentos:${i.se_faltar}`)
    }
  }
  if (entrega.para_ter) ids.add(`alimentos:${entrega.para_ter.alimento_id}`)
  for (const linha of entrega.citados) {
    ids.add(linha)
    for (const a of alimentosDaLinha(kb, linha)) ids.add(`alimentos:${a}`)
  }
  return ids
}

function textoLimpo(texto: string): string {
  let limpo = ` ${normalizar(texto)} `
  for (const expressao of config.resposta.expressoesIgnoradas) {
    limpo = limpo.split(` ${normalizar(expressao)} `).join("  ")
  }
  return limpo
}

function citadoNoTexto(texto: string, nomes: string[]): boolean {
  return nomes.some((n) => n !== "" && texto.includes(` ${normalizar(n)} `))
}

function checarTextoSemEstrutura(ctx: Ctx): void {
  const texto = textoLimpo(ctx.entrega.resposta)
  const presentes = idsEstruturados(ctx.entrega, ctx.kb)
  for (const a of ctx.kb.alimentos) {
    if (!presentes.has(`alimentos:${a.id}`) && citadoNoTexto(texto, [a.nome, ...a.sinonimos])) {
      apontar(
        ctx,
        "texto_sem_estrutura",
        "resposta",
        `${a.id} aparece no texto e não está na parte estruturada`,
      )
    }
  }
  for (const p of ctx.kb.praticas) {
    if (!presentes.has(`praticas:${p.id}`) && citadoNoTexto(texto, [p.nome])) {
      apontar(
        ctx,
        "texto_sem_estrutura",
        "resposta",
        `${p.id} aparece no texto e não está na parte estruturada`,
      )
    }
  }
}

function checarTamanhoDaResposta(ctx: Ctx): void {
  const { resposta } = ctx.entrega
  const { maxCaracteres } = config.resposta
  if (resposta.trim() === "" || resposta.length > maxCaracteres) {
    apontar(ctx, "tamanho", "resposta", `a resposta deve ter de 1 a ${maxCaracteres} caracteres`)
  }
}

function checarQuantidades(ctx: Ctx): void {
  const { maxSugestoes, maxMotivo, maxIncertos, maxIncertoCaracteres, maxCitados } = config.resposta
  const { sugestoes, incertos, citados } = ctx.entrega
  if (sugestoes.length > maxSugestoes)
    apontar(ctx, "tamanho", "sugestoes", `no máximo ${maxSugestoes} sugestões`)
  if (incertos.length > maxIncertos)
    apontar(ctx, "tamanho", "incertos", `no máximo ${maxIncertos} incertos`)
  if (citados.length > maxCitados)
    apontar(ctx, "tamanho", "citados", `no máximo ${maxCitados} citados`)
  sugestoes.forEach((s, i) => {
    if (s.motivo.length > maxMotivo) {
      apontar(
        ctx,
        "tamanho",
        `sugestoes[${i}].motivo`,
        `o motivo deve ter até ${maxMotivo} caracteres`,
      )
    }
  })
  incertos.forEach((t, i) => {
    if (t.length > maxIncertoCaracteres) {
      apontar(
        ctx,
        "tamanho",
        `incertos[${i}]`,
        `o incerto deve ter até ${maxIncertoCaracteres} caracteres`,
      )
    }
  })
}

function checarVazia(ctx: Ctx): void {
  const { dados, entrega } = ctx
  const vazia = entrega.sugestoes.length === 0 && entrega.incertos.length === 0
  if (dados.intencoes.includes("momento") && dados.candidatos.length > 0 && vazia) {
    apontar(
      ctx,
      "vazia",
      "sugestoes",
      "há candidatos no contexto: sugira ao menos um ou registre um incerto",
    )
  }
}

export function validarEntrega(entrega: EntregaDoModelo, p: Parametros): Violacao[] {
  const ctx: Ctx = { ...p, entrega, violacoes: [], chaves: new Set() }
  entrega.sugestoes.forEach((s, i) => {
    checarSugestao(ctx, s, i)
  })
  checarTamanhoDaResposta(ctx)
  checarQuantidades(ctx)
  checarQualidadesGerais(ctx)
  checarEvitar(ctx)
  checarCitados(ctx)
  checarParaTer(ctx)
  checarTextoSemEstrutura(ctx)
  checarVazia(ctx)
  return ctx.violacoes
}
