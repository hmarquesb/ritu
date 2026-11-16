import { config } from "@config/index"
import { llmCotas } from "@config/llm-cotas"
import type { AccountRepository, ItemTemporario, ProfileStore } from "@/core/accounts/ports"
import type { Conta, Perfil } from "@/core/accounts/types"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import { normalizar } from "@/core/knowledge/identificar"
import { diaDaCota, janelaDoMinuto } from "@/core/llm/janelas"
import type { Limites, UsageLedger, UsoDoModelo } from "@/core/llm/ledger"
import { momentoSchema, prakritiSchema, sugestaoRegistradaSchema } from "@/core/memory-schemas"
import type { Mensagem, MessageRepository } from "@/core/messages/ports"
import type { OutcomeStore, Retorno } from "@/core/outcomes/ports"
import type { PantryStore, ReferenciaDeItem } from "@/core/pantry/ports"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { Padrao, PatternStore } from "@/core/patterns/ports"
import type { ItemTipo, PreferenceStore, Preferencia } from "@/core/preferences/ports"
import type { ProposalStore, Proposta } from "@/core/proposals/ports"
import type { NotaDeRotina, ResumoDeRotina, RoutineStore } from "@/core/routine/ports"
import { RunAbertoError } from "@/core/runs/errors"
import type { Run, RunEtapa, RunRepository, StatusRun } from "@/core/runs/ports"
import type { ItemDaLista, ShortageStore } from "@/core/shortages/ports"
import type { Stores, Transactor } from "@/core/stores"

export type OpcoesMemoria = {
  /** Diz se o id é um alimento da base. Padrão: aceita qualquer id. */
  alimentoExiste?: (id: string) => boolean
}

type Falta = {
  conta_id: string
  alimento_id: string
  origem: "teria_entrado" | "nao_tenho"
  run_id: string | null
  dia: string
}

type EvitarDoDia = { conta_id: string; dia: string; item: ItemTemporario }

type Voto = { conta_id: string; run_id: string; voto: "up" | "down" }

type Estado = {
  contas: Conta[]
  perfis: Perfil[]
  itensCasa: ItemDaCasa[]
  desconhecidos: Record<string, number>
  faltas: Falta[]
  lista: ItemDaLista[]
  preferencias: Preferencia[]
  evitarDoDia: EvitarDoDia[]
  notas: NotaDeRotina[]
  resumos: ResumoDeRotina[]
  padroes: Padrao[]
  mensagens: Mensagem[]
  retornos: Retorno[]
  runs: Run[]
  etapas: RunEtapa[]
  votos: Voto[]
  propostas: Proposta[]
}

/** Guarda o estado atual. A transação troca o estado por uma cópia e volta se falhar. */
type Db = { estado: Estado }

type Ref = { alimento: string } | { livre: string }

const TEXTO_NOTA_MAX = 200

const STATUS_ABERTOS: StatusRun[] = ["running", "waiting_for_input", "waiting_for_approval"]
const STATUS_EM_ESPERA: StatusRun[] = ["waiting_for_input", "waiting_for_approval"]

function estadoVazio(): Estado {
  return {
    contas: [],
    perfis: [],
    itensCasa: [],
    desconhecidos: {},
    faltas: [],
    lista: [],
    preferencias: [],
    evitarDoDia: [],
    notas: [],
    resumos: [],
    padroes: [],
    mensagens: [],
    retornos: [],
    runs: [],
    etapas: [],
    votos: [],
    propostas: [],
  }
}

const copia = <T>(valor: T): T => structuredClone(valor)

const agoraIso = (clock: Clock): string => clock.now().toISOString()

/** Separa a lista em quem fica e quantos saíram. */
function separa<T>(lista: T[], sai: (x: T) => boolean): { mantidos: T[]; apagados: number } {
  const mantidos = lista.filter((x) => !sai(x))
  return { mantidos, apagados: lista.length - mantidos.length }
}

/** Carimbo ISO anterior ao limite. */
const anteriorA = (iso: string, limite: Date): boolean => Date.parse(iso) < limite.getTime()

const maisNovoPrimeiro = (a: { criado_em: string }, b: { criado_em: string }): number =>
  Date.parse(b.criado_em) - Date.parse(a.criado_em)

const mesmoEvitar = (a: ItemTemporario, b: ItemTemporario): boolean =>
  a.tipo === b.tipo && normalizar(a.valor) === normalizar(b.valor)

const estaVencida = (conta: Conta, clock: Clock): boolean =>
  conta.tipo === "demo" &&
  conta.expira_em !== null &&
  Date.parse(conta.expira_em) <= clock.now().getTime()

const arredonda2 = (n: number): number => Math.round(n * 100) / 100

/** Datas no formato AAAA-MM-DD comparam pela ordem das letras. */
function maisRecente(a: string, b: string): string {
  if (b > a) return b
  return a
}

function novoPerfil(contaId: string, agora: string): Perfil {
  return {
    conta_id: contaId,
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: agora,
  }
}

/**
 * Remove, do estado, tudo o que é da conta. Os runs ficam sem conta e sem o que
 * identifica a pessoa (saída, checkpoint, pendência, clima); as etapas perdem o resumo.
 */
function apagarDadosDaConta(e: Estado, contaId: string): void {
  const runsDaConta = new Set(e.runs.filter((r) => r.conta_id === contaId).map((r) => r.id))
  for (const run of e.runs) {
    if (run.conta_id !== contaId) continue
    Object.assign(run, {
      conta_id: null,
      saida: null,
      checkpoint: null,
      pendencia: null,
      clima_usado: null,
    })
  }
  for (const etapa of e.etapas) {
    if (runsDaConta.has(etapa.run_id)) etapa.resumo = null
  }

  const deOutra = (conta_id: string | null): boolean => conta_id !== contaId
  e.contas = e.contas.filter((c) => c.id !== contaId)
  e.perfis = e.perfis.filter((p) => deOutra(p.conta_id))
  e.itensCasa = e.itensCasa.filter((i) => deOutra(i.conta_id))
  e.faltas = e.faltas.filter((f) => deOutra(f.conta_id))
  e.lista = e.lista.filter((l) => deOutra(l.conta_id))
  e.preferencias = e.preferencias.filter((p) => deOutra(p.conta_id))
  e.evitarDoDia = e.evitarDoDia.filter((x) => deOutra(x.conta_id))
  e.notas = e.notas.filter((n) => deOutra(n.conta_id))
  e.resumos = e.resumos.filter((r) => deOutra(r.conta_id))
  e.padroes = e.padroes.filter((p) => deOutra(p.conta_id))
  e.mensagens = e.mensagens.filter((m) => deOutra(m.conta_id))
  e.retornos = e.retornos.filter((r) => deOutra(r.conta_id))
  e.votos = e.votos.filter((v) => deOutra(v.conta_id))
  e.propostas = e.propostas.filter((p) => deOutra(p.conta_id))
}

function criarAccounts(db: Db, clock: Clock): AccountRepository {
  return {
    async criar(dados) {
      const conta: Conta = {
        id: crypto.randomUUID(),
        tipo: dados.tipo,
        google_sub: dados.google_sub ?? null,
        email: dados.email ?? null,
        expira_em: dados.expira_em?.toISOString() ?? null,
        tester: false,
        aviso_aceito_em: null,
        evitar_passo: null,
        evitar_lembrete_em: null,
        dosha_adiado_em: null,
        criado_em: clock.now().toISOString(),
      }
      db.estado.contas.push(conta)
      return copia(conta)
    },
    async buscar(contaId) {
      const conta = db.estado.contas.find((c) => c.id === contaId)
      if (!conta || estaVencida(conta, clock)) return undefined
      return copia(conta)
    },
    async buscarPorGoogleSub(sub) {
      const conta = db.estado.contas.find((c) => c.google_sub === sub)
      return conta ? copia(conta) : undefined
    },
    async marcar(contaId, campos) {
      const conta = db.estado.contas.find((c) => c.id === contaId)
      if (conta) Object.assign(conta, campos)
    },
    async apagar(contaId) {
      apagarDadosDaConta(db.estado, contaId)
    },
    async apagarDemosVencidas() {
      const vencidas = db.estado.contas.filter((c) => estaVencida(c, clock))
      for (const conta of vencidas) apagarDadosDaConta(db.estado, conta.id)
      return vencidas.length
    },
  }
}

function criarProfiles(db: Db, clock: Clock): ProfileStore {
  const editar = (contaId: string, mudar: (perfil: Perfil) => void): void => {
    const agora = clock.now().toISOString()
    let perfil = db.estado.perfis.find((p) => p.conta_id === contaId)
    if (!perfil) {
      perfil = novoPerfil(contaId, agora)
      db.estado.perfis.push(perfil)
    }
    mudar(perfil)
    perfil.atualizado_em = agora
  }

  return {
    async ler(contaId) {
      const perfil = db.estado.perfis.find((p) => p.conta_id === contaId)
      return copia(perfil ?? novoPerfil(contaId, clock.now().toISOString()))
    },
    async definirPrakriti(contaId, prakriti, origem) {
      editar(contaId, (p) => {
        p.prakriti = prakriti === null ? null : prakritiSchema.parse(prakriti)
        p.origem = origem
      })
    },
    async definirCidade(contaId, cidade) {
      editar(contaId, (p) => {
        p.cidade_nome = cidade?.nome ?? null
        p.cidade_lat = cidade ? arredonda2(cidade.lat) : null
        p.cidade_lon = cidade ? arredonda2(cidade.lon) : null
        p.cidade_fuso = cidade?.fuso ?? null
      })
    },
    async definirRestricoes(contaId, restricoes) {
      editar(contaId, (p) => {
        p.restricoes = [...restricoes]
      })
    },
    async definirNaoCome(contaId, itens) {
      editar(contaId, (p) => {
        p.nao_come = copia(itens)
      })
    },
    async acrescentarEvitarSempre(contaId, itens) {
      editar(contaId, (p) => {
        for (const item of itens) {
          if (p.evitar_sempre.some((x) => mesmoEvitar(x, item))) continue
          p.evitar_sempre.push({
            tipo: item.tipo,
            valor: item.valor,
            desde: clock.now().toISOString(),
          })
        }
      })
    },
    async removerEvitarSempre(contaId, item, opts) {
      if (opts?.confirmado !== true) {
        throw new RituError("confirmacao_necessaria", "Remover de evitar sempre exige confirmação")
      }
      editar(contaId, (p) => {
        p.evitar_sempre = p.evitar_sempre.filter((x) => !mesmoEvitar(x, item))
      })
    },
    async evitarTemporario(contaId, dia) {
      return copia(
        db.estado.evitarDoDia
          .filter((x) => x.conta_id === contaId && x.dia === dia)
          .map((x) => x.item),
      )
    },
    async acrescentarEvitarTemporario(contaId, dia, itens) {
      const e = db.estado
      for (const item of itens) {
        const ja = e.evitarDoDia.some(
          (x) => x.conta_id === contaId && x.dia === dia && mesmoEvitar(x.item, item),
        )
        if (!ja) e.evitarDoDia.push({ conta_id: contaId, dia, item: { ...item } })
      }
    },
    async apagarEvitarTemporarioAntesDe(dia) {
      const e = db.estado
      const antigos = e.evitarDoDia.filter((x) => x.dia < dia).length
      e.evitarDoDia = e.evitarDoDia.filter((x) => x.dia >= dia)
      return antigos
    },
  }
}

/** Resolve a referência: id da base vira alimento; id desconhecido vira nome livre (o id é o nome). */
function resolverRef(ref: ReferenciaDeItem, existe: (id: string) => boolean): Ref {
  if (ref.alimento_id !== undefined) {
    return existe(ref.alimento_id) ? { alimento: ref.alimento_id } : { livre: ref.alimento_id }
  }
  return { livre: ref.nome_livre ?? "" }
}

function acharItem(e: Estado, contaId: string, ref: Ref): ItemDaCasa | undefined {
  return e.itensCasa.find((i) => {
    if (i.conta_id !== contaId) return false
    if ("alimento" in ref) return i.alimento_id === ref.alimento
    return i.nome_normalizado === normalizar(ref.livre)
  })
}

function marcarTem(item: ItemDaCasa, origem: ItemDaCasa["origem"], agora: string): void {
  item.estado = "tem"
  item.confirmado_em = agora
  item.origem = origem
}

function criarPantry(db: Db, clock: Clock, existe: (id: string) => boolean): PantryStore {
  const registrarAlimento = (contaId: string, alimento: string, origem: ItemDaCasa["origem"]) => {
    const e = db.estado
    const agora = clock.now().toISOString()
    const existente = acharItem(e, contaId, { alimento })
    if (existente) {
      marcarTem(existente, origem, agora)
    } else {
      e.itensCasa.push({
        id: crypto.randomUUID(),
        conta_id: contaId,
        alimento_id: alimento,
        nome_livre: null,
        nome_normalizado: null,
        estado: "tem",
        sempre_tenho: false,
        confirmado_em: agora,
        origem,
      })
    }
    e.faltas = e.faltas.filter((f) => !(f.conta_id === contaId && f.alimento_id === alimento))
    e.lista = e.lista.filter((l) => !(l.conta_id === contaId && l.alimento_id === alimento))
  }

  const registrarLivre = (contaId: string, nome: string, origem: ItemDaCasa["origem"]) => {
    const e = db.estado
    const agora = clock.now().toISOString()
    const normalizado = normalizar(nome)
    const existente = acharItem(e, contaId, { livre: nome })
    if (existente) {
      marcarTem(existente, origem, agora)
    } else {
      e.itensCasa.push({
        id: crypto.randomUUID(),
        conta_id: contaId,
        alimento_id: null,
        nome_livre: nome,
        nome_normalizado: normalizado,
        estado: "tem",
        sempre_tenho: false,
        confirmado_em: agora,
        origem,
      })
    }
    e.desconhecidos[normalizado] = (e.desconhecidos[normalizado] ?? 0) + 1
  }

  const mudarItens = (
    contaId: string,
    itens: ReferenciaDeItem[],
    mudar: (i: ItemDaCasa) => void,
  ) => {
    for (const ref of itens) {
      const item = acharItem(db.estado, contaId, resolverRef(ref, existe))
      if (item) mudar(item)
    }
  }

  return {
    async listar(contaId) {
      return copia(db.estado.itensCasa.filter((i) => i.conta_id === contaId))
    },
    async registrar(contaId, itens, origem) {
      for (const ref of itens) {
        const r = resolverRef(ref, existe)
        if ("alimento" in r) registrarAlimento(contaId, r.alimento, origem)
        else registrarLivre(contaId, r.livre, origem)
      }
    },
    async marcarAcabou(contaId, itens) {
      mudarItens(contaId, itens, (i) => {
        i.estado = "acabou"
      })
    },
    async definirSempreTenho(contaId, itemId, valor) {
      const item = db.estado.itensCasa.find((i) => i.id === itemId && i.conta_id === contaId)
      if (item) item.sempre_tenho = valor
    },
    async tirar(contaId, itemId) {
      db.estado.itensCasa = db.estado.itensCasa.filter(
        (i) => !(i.id === itemId && i.conta_id === contaId),
      )
    },
    async desconhecidos(limite) {
      return Object.entries(db.estado.desconhecidos)
        .map(([nome, vezes]) => ({ nome, vezes }))
        .sort((a, b) => b.vezes - a.vezes)
        .slice(0, limite)
    },
  }
}

function criarShortages(db: Db, clock: Clock): ShortageStore {
  return {
    async registrar(contaId, faltas, dia) {
      const e = db.estado
      for (const falta of faltas) {
        const ja = e.faltas.some(
          (f) => f.conta_id === contaId && f.alimento_id === falta.alimento_id && f.dia === dia,
        )
        if (!ja) {
          e.faltas.push({
            conta_id: contaId,
            alimento_id: falta.alimento_id,
            origem: falta.origem,
            run_id: falta.run_id ?? null,
            dia,
          })
        }
      }
    },
    async diasComFalta(contaId, desdeDia) {
      const dias = new Map<string, string[]>()
      for (const f of db.estado.faltas) {
        if (f.conta_id !== contaId || f.dia < desdeDia) continue
        dias.set(f.alimento_id, [...(dias.get(f.alimento_id) ?? []), f.dia])
      }
      return [...dias].map(([alimento_id, datas]) => ({
        alimento_id,
        dias: datas.length,
        ultimo_dia: datas.reduce(maisRecente),
      }))
    },
    async apagarDoAlimento(contaId, alimentoId) {
      db.estado.faltas = db.estado.faltas.filter(
        (f) => !(f.conta_id === contaId && f.alimento_id === alimentoId),
      )
    },
    async lista(contaId) {
      return copia(db.estado.lista.filter((l) => l.conta_id === contaId))
    },
    async porNaLista(contaId, item) {
      const agora = clock.now().toISOString()
      const e = db.estado
      const linha = e.lista.find(
        (l) => l.conta_id === contaId && l.alimento_id === item.alimento_id,
      )
      if (linha) {
        Object.assign(linha, { motivo: item.motivo, detalhe: item.detalhe, criado_em: agora })
      } else {
        e.lista.push({ conta_id: contaId, ...item, criado_em: agora })
      }
    },
    async tirarDaLista(contaId, alimentoId) {
      db.estado.lista = db.estado.lista.filter(
        (l) => !(l.conta_id === contaId && l.alimento_id === alimentoId),
      )
    },
    async apagarFaltasAntesDe(dia) {
      const e = db.estado
      const antigas = e.faltas.filter((f) => f.dia < dia).length
      e.faltas = e.faltas.filter((f) => f.dia >= dia)
      return antigas
    },
  }
}

function criarPreferences(db: Db, clock: Clock): PreferenceStore {
  const achaOuCria = (contaId: string, item: { tipo: ItemTipo; id: string }): Preferencia => {
    const e = db.estado
    const existente = e.preferencias.find(
      (p) => p.conta_id === contaId && p.item_tipo === item.tipo && p.item_id === item.id,
    )
    if (existente) return existente
    const nova: Preferencia = {
      conta_id: contaId,
      item_tipo: item.tipo,
      item_id: item.id,
      gosto: null,
      ajudou: 0,
      nao_ajudou: 0,
      nao_fez: 0,
      ultimos_resultados: [],
      ultima_sugestao_em: null,
    }
    e.preferencias.push(nova)
    return nova
  }

  return {
    async ler(contaId, itens) {
      const da_conta = db.estado.preferencias.filter((p) => p.conta_id === contaId)
      if (itens === undefined) return copia(da_conta)
      return copia(
        da_conta.filter((p) => itens.some((i) => i.tipo === p.item_tipo && i.id === p.item_id)),
      )
    },
    async definirGosto(contaId, item, gosto) {
      achaOuCria(contaId, item).gosto = gosto
    },
    async contarResultado(contaId, item, resultado) {
      const pref = achaOuCria(contaId, item)
      if (resultado === "nao_fez") {
        pref.nao_fez += 1
        return
      }
      pref[resultado] += 1
      pref.ultimos_resultados = [resultado, ...pref.ultimos_resultados].slice(0, 2)
    },
    async marcarSugerido(contaId, itens) {
      const agora = clock.now().toISOString()
      for (const item of itens) achaOuCria(contaId, item).ultima_sugestao_em = agora
    },
    async contagem(contaId) {
      const da_conta = db.estado.preferencias.filter((p) => p.conta_id === contaId)
      return {
        de_gosto: da_conta.filter((p) => p.gosto !== null).length,
        de_resultado: da_conta.filter((p) => p.ajudou + p.nao_ajudou + p.nao_fez > 0).length,
      }
    },
    async apagar(contaId, item) {
      db.estado.preferencias = db.estado.preferencias.filter(
        (p) => !(p.conta_id === contaId && p.item_tipo === item.tipo && p.item_id === item.id),
      )
    },
  }
}

const ultimoResumo = (e: Estado, contaId: string): ResumoDeRotina | undefined =>
  e.resumos.filter((r) => r.conta_id === contaId).sort((a, b) => b.versao - a.versao)[0]

function criarRoutine(db: Db, clock: Clock): RoutineStore {
  return {
    async notasAtivas(contaId) {
      return copia(db.estado.notas.filter((n) => n.conta_id === contaId && n.ativa))
    },
    async anotar(contaId, texto) {
      if (texto.length > TEXTO_NOTA_MAX) {
        throw new RituError("texto_longo", "Nota longa demais para a rotina")
      }
      const nota: NotaDeRotina = {
        id: crypto.randomUUID(),
        conta_id: contaId,
        texto,
        ativa: true,
        criado_em: agoraIso(clock),
      }
      db.estado.notas.push(nota)
      return copia(nota)
    },
    async desativar(contaId, notaId) {
      const nota = db.estado.notas.find((n) => n.id === notaId && n.conta_id === contaId)
      if (nota) nota.ativa = false
    },
    async resumo(contaId) {
      const atual = ultimoResumo(db.estado, contaId)
      return atual ? copia(atual) : undefined
    },
    async gravarResumo(contaId, texto) {
      if (texto.length > config.memoria.resumoRotinaCaracteres) {
        throw new RituError("texto_longo", "Resumo longo demais para a rotina")
      }
      const anterior = ultimoResumo(db.estado, contaId)
      const resumo: ResumoDeRotina = {
        conta_id: contaId,
        versao: (anterior?.versao ?? 0) + 1,
        texto,
        criado_em: agoraIso(clock),
      }
      db.estado.resumos.push(resumo)
      return copia(resumo)
    },
  }
}

function criarPatterns(db: Db, clock: Clock): PatternStore {
  const padraoDaConta = (contaId: string, padraoId: string): Padrao | undefined =>
    db.estado.padroes.find((p) => p.id === padraoId && p.conta_id === contaId)

  return {
    async listar(contaId, status) {
      return copia(
        db.estado.padroes.filter(
          (p) => p.conta_id === contaId && (status === undefined || p.status === status),
        ),
      )
    },
    async propor(contaId, p) {
      const existe = db.estado.padroes.some(
        (x) => x.conta_id === contaId && x.tipo === p.tipo && x.chave === p.chave,
      )
      if (existe) return undefined
      const padrao: Padrao = {
        id: crypto.randomUUID(),
        conta_id: contaId,
        tipo: p.tipo,
        chave: p.chave,
        frase: p.frase,
        ocorrencias: p.ocorrencias,
        status: "candidato",
        criado_em: agoraIso(clock),
        decidido_em: null,
      }
      db.estado.padroes.push(padrao)
      return copia(padrao)
    },
    async decidir(contaId, padraoId, status) {
      const padrao = padraoDaConta(contaId, padraoId)
      if (!padrao) return
      padrao.status = status
      padrao.decidido_em = agoraIso(clock)
    },
    async apagar(contaId, padraoId) {
      db.estado.padroes = db.estado.padroes.filter(
        (p) => !(p.id === padraoId && p.conta_id === contaId),
      )
    },
  }
}

function criarMessages(db: Db, clock: Clock): MessageRepository {
  return {
    async gravar(contaId, m) {
      const mensagem: Mensagem = {
        id: crypto.randomUUID(),
        conta_id: contaId,
        run_id: m.run_id ?? null,
        autor: m.autor,
        texto: m.texto,
        com_incomodo: m.com_incomodo,
        dia: m.dia,
        criado_em: agoraIso(clock),
      }
      db.estado.mensagens.push(mensagem)
      return copia(mensagem)
    },
    async doDia(contaId, dia) {
      const doDiaDaConta = db.estado.mensagens.filter(
        (m) => m.conta_id === contaId && m.dia === dia,
      )
      return copia(doDiaDaConta.sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em)))
    },
    async marcarIncomodoDoRun(contaId, runId) {
      for (const m of db.estado.mensagens) {
        if (m.conta_id === contaId && m.run_id === runId) m.com_incomodo = true
      }
    },
    async apagarAntesDe(limite) {
      const { mantidos, apagados } = separa(db.estado.mensagens, (m) =>
        anteriorA(m.criado_em, limite),
      )
      db.estado.mensagens = mantidos
      return apagados
    },
    async apagarComIncomodoAntesDoDia(dia) {
      const { mantidos, apagados } = separa(
        db.estado.mensagens,
        (m) => m.com_incomodo && m.dia < dia,
      )
      db.estado.mensagens = mantidos
      return apagados
    },
  }
}

function criarOutcomes(db: Db, clock: Clock): OutcomeStore {
  const retornoDaConta = (contaId: string, retornoId: string): Retorno | undefined =>
    db.estado.retornos.find((r) => r.id === retornoId && r.conta_id === contaId)

  return {
    async criar(contaId, runId, sugestoes) {
      const agora = agoraIso(clock)
      const criados = sugestoes.map(
        (s): Retorno => ({
          id: crypto.randomUUID(),
          conta_id: contaId,
          run_id: runId,
          sugestao: sugestaoRegistradaSchema.parse(s),
          status: "aguardando",
          resultado: null,
          origem: null,
          criado_em: agora,
          respondido_em: null,
        }),
      )
      db.estado.retornos.push(...criados)
      return copia(criados)
    },
    async pendentes(contaId) {
      return copia(
        db.estado.retornos
          .filter((r) => r.conta_id === contaId && r.status === "aguardando")
          .sort(maisNovoPrimeiro),
      )
    },
    async responder(contaId, retornoId, resultado, origem) {
      const retorno = retornoDaConta(contaId, retornoId)
      if (!retorno) return undefined
      const mudou = retorno.status === "aguardando"
      if (mudou) {
        Object.assign(retorno, {
          status: "respondido",
          resultado,
          origem,
          respondido_em: agoraIso(clock),
        })
      }
      return { retorno: copia(retorno), mudou }
    },
    async atualizarSugestao(contaId, retornoId, sugestao) {
      // Valida antes de mexer: uma sugestão inválida não deixa nada alterado.
      const valida = sugestaoRegistradaSchema.parse(sugestao)
      const retorno = retornoDaConta(contaId, retornoId)
      if (retorno?.status !== "aguardando") return undefined
      retorno.sugestao = valida
      return copia(retorno)
    },
    async doRun(contaId, runId) {
      return copia(db.estado.retornos.filter((r) => r.conta_id === contaId && r.run_id === runId))
    },
    async apagarAguardandoAntesDe(limite) {
      const { mantidos, apagados } = separa(
        db.estado.retornos,
        (r) => r.status === "aguardando" && anteriorA(r.criado_em, limite),
      )
      db.estado.retornos = mantidos
      return apagados
    },
  }
}

function criarRuns(db: Db, clock: Clock): RunRepository {
  const runDaConta = (contaId: string, runId: string): Run | undefined =>
    db.estado.runs.find((r) => r.id === runId && r.conta_id === contaId)
  const abertoDaConta = (contaId: string): Run | undefined =>
    db.estado.runs.find((r) => r.conta_id === contaId && STATUS_ABERTOS.includes(r.status))

  return {
    async criar(contaId, r) {
      if (abertoDaConta(contaId)) throw new RunAbertoError()
      const agora = agoraIso(clock)
      const run: Run = {
        id: crypto.randomUUID(),
        conta_id: contaId,
        caminho: r.caminho,
        intencoes: [...r.intencoes],
        status: "running",
        checkpoint: null,
        pendencia: null,
        momento: null,
        com_incomodo: false,
        clima_usado: null,
        saida: null,
        passos: 0,
        tokens_entrada: 0,
        tokens_saida: 0,
        latencia_ms: 0,
        modelos: {},
        trocas_de_modelo: 0,
        prompt_versao: null,
        juiz_tentativas: 0,
        juiz_aprovado: null,
        trace_id: r.trace_id ?? null,
        dia: r.dia,
        criado_em: agora,
        atualizado_em: agora,
      }
      db.estado.runs.push(run)
      return copia(run)
    },
    async buscar(contaId, runId) {
      const run = runDaConta(contaId, runId)
      return run ? copia(run) : undefined
    },
    async aberto(contaId) {
      const run = abertoDaConta(contaId)
      return run ? copia(run) : undefined
    },
    async atualizar(contaId, runId, campos) {
      const run = runDaConta(contaId, runId)
      if (!run) return
      if (campos.momento) momentoSchema.parse(campos.momento)
      Object.assign(run, campos, { atualizado_em: agoraIso(clock) })
    },
    async mudarStatusSe(contaId, runId, de, para) {
      const run = runDaConta(contaId, runId)
      if (run?.status !== de) return false
      Object.assign(run, { status: para, atualizado_em: agoraIso(clock) })
      return true
    },
    async acrescentarEtapa(contaId, runId, etapa) {
      if (!runDaConta(contaId, runId))
        throw new RituError("run_nao_encontrado", "Run não encontrado")
      const ordens = db.estado.etapas.filter((x) => x.run_id === runId).map((x) => x.ordem)
      const nova: RunEtapa = {
        ...etapa,
        run_id: runId,
        ordem: Math.max(0, ...ordens) + 1,
        criado_em: agoraIso(clock),
      }
      db.estado.etapas.push(nova)
      return copia(nova)
    },
    async etapas(contaId, runId) {
      if (!runDaConta(contaId, runId)) return []
      return copia(
        db.estado.etapas.filter((x) => x.run_id === runId).sort((a, b) => a.ordem - b.ordem),
      )
    },
    async recentes(contaId, desde, limite) {
      const feitos = db.estado.runs.filter(
        (r) =>
          r.conta_id === contaId &&
          r.status === "done" &&
          Date.parse(r.criado_em) >= desde.getTime(),
      )
      return copia(feitos.sort(maisNovoPrimeiro).slice(0, limite))
    },
    async contarMensagensDoDia(contaId, dia) {
      return db.estado.mensagens.filter(
        (m) => m.conta_id === contaId && m.dia === dia && m.autor === "pessoa",
      ).length
    },
    async votar(contaId, runId, voto) {
      if (!runDaConta(contaId, runId)) return
      const existente = db.estado.votos.find((v) => v.conta_id === contaId && v.run_id === runId)
      if (existente) existente.voto = voto
      else db.estado.votos.push({ conta_id: contaId, run_id: runId, voto })
    },
    async expirarEmEsperaAntesDe(limite) {
      const alvos = db.estado.runs.filter(
        (r) => STATUS_EM_ESPERA.includes(r.status) && anteriorA(r.atualizado_em, limite),
      )
      for (const run of alvos) run.status = "expired"
      return alvos.map((r) => r.id)
    },
  }
}

function criarProposals(db: Db, clock: Clock): ProposalStore {
  return {
    async criar(contaId, runId, propostas) {
      const agora = agoraIso(clock)
      const criadas = propostas.map(
        (p): Proposta => ({
          id: crypto.randomUUID(),
          run_id: runId,
          conta_id: contaId,
          tool: p.tool,
          conteudo: copia(p.conteudo),
          decisao: "pendente",
          criado_em: agora,
          decidida_em: null,
        }),
      )
      db.estado.propostas.push(...criadas)
      return copia(criadas)
    },
    async doRun(contaId, runId) {
      return copia(db.estado.propostas.filter((p) => p.conta_id === contaId && p.run_id === runId))
    },
    async decidir(contaId, propostaId, decisao) {
      const proposta = db.estado.propostas.find(
        (p) => p.id === propostaId && p.conta_id === contaId,
      )
      if (!proposta) return undefined
      if (proposta.decisao === "pendente") {
        Object.assign(proposta, { decisao, decidida_em: agoraIso(clock) })
      }
      return copia(proposta)
    },
    async recusadas(contaId, tool) {
      return copia(
        db.estado.propostas.filter(
          (p) => p.conta_id === contaId && p.tool === tool && p.decisao === "recusada",
        ),
      )
    },
    async expirarDosRuns(runIds) {
      const alvos = db.estado.propostas.filter(
        (p) => p.decisao === "pendente" && runIds.includes(p.run_id),
      )
      for (const proposta of alvos) proposta.decisao = "expirada"
      return alvos.length
    },
  }
}

/**
 * Fake em memória das portas. Um estado só, para as regras cruzadas valerem também aqui.
 */
export function createMemoryStores(clock: Clock, opts: OpcoesMemoria = {}): Stores & Transactor {
  const db: Db = { estado: estadoVazio() }
  const existe = opts.alimentoExiste ?? (() => true)

  const stores: Stores = {
    accounts: criarAccounts(db, clock),
    profiles: criarProfiles(db, clock),
    pantry: criarPantry(db, clock, existe),
    preferences: criarPreferences(db, clock),
    outcomes: criarOutcomes(db, clock),
    shortages: criarShortages(db, clock),
    routine: criarRoutine(db, clock),
    patterns: criarPatterns(db, clock),
    messages: criarMessages(db, clock),
    runs: criarRuns(db, clock),
    proposals: criarProposals(db, clock),
  }

  return {
    ...stores,
    async emTransacao<T>(fn: (s: Stores) => Promise<T>): Promise<T> {
      const antes = copia(db.estado)
      try {
        return await fn(stores)
      } catch (erro) {
        db.estado = antes
        throw erro
      }
    },
  }
}

type LinhaDeUso = {
  pedidos: number
  tokens: number
  rate_limits: number
  esgotado: boolean
}

const MS_DIA = 24 * 60 * 60 * 1000

/**
 * Fake em memória do registro de uso. Cada operação é síncrona por dentro, então
 * a reserva é atômica. `limitesPorTeste` troca os limites de um modelo nos testes.
 */
export function createMemoryLedger(
  clock: Clock,
  limitesPorTeste: Partial<Record<string, Limites>> = {},
): UsageLedger {
  const minutos = new Map<string, LinhaDeUso>()
  const dias = new Map<string, LinhaDeUso>()
  const chave = (modelo: string, inicio: string) => `${modelo}\u0000${inicio}`
  const vazia = (): LinhaDeUso => ({ pedidos: 0, tokens: 0, rate_limits: 0, esgotado: false })

  function correntes(modelo: string) {
    const agora = clock.now()
    return {
      kMinuto: chave(modelo, janelaDoMinuto(agora)),
      kDia: chave(modelo, diaDaCota(agora)),
    }
  }

  function obter(mapa: Map<string, LinhaDeUso>, k: string): LinhaDeUso {
    let linha = mapa.get(k)
    if (!linha) {
      linha = vazia()
      mapa.set(k, linha)
    }
    return linha
  }

  function apagarDe(mapa: Map<string, LinhaDeUso>, antesDe: number): number {
    let apagadas = 0
    for (const k of [...mapa.keys()]) {
      const inicio = k.split("\u0000")[1] ?? ""
      if (new Date(inicio).getTime() < antesDe) {
        mapa.delete(k)
        apagadas++
      }
    }
    return apagadas
  }

  return {
    async reservar(modelo, limitesRecebidos) {
      const limites = limitesPorTeste[modelo] ?? limitesRecebidos
      const { kMinuto, kDia } = correntes(modelo)
      const min = minutos.get(kMinuto) ?? vazia()
      const dia = dias.get(kDia) ?? vazia()
      if (min.esgotado || dia.esgotado) return false
      if (min.pedidos >= limites.rpm || min.tokens >= limites.tpm) return false
      if (dia.pedidos >= limites.rpd) return false
      obter(minutos, kMinuto).pedidos++
      obter(dias, kDia).pedidos++
      return true
    },

    async registrarTokens(modelo, tokens) {
      const { kMinuto, kDia } = correntes(modelo)
      obter(minutos, kMinuto).tokens += tokens
      obter(dias, kDia).tokens += tokens
    },

    async registrarRateLimit(modelo) {
      const { kMinuto, kDia } = correntes(modelo)
      obter(minutos, kMinuto).esgotado = true
      const dia = obter(dias, kDia)
      dia.rate_limits++
      if (dia.rate_limits >= llmCotas.rateLimitsParaEsgotarODia) dia.esgotado = true
    },

    async uso() {
      return Object.keys(llmCotas.modelos).map((modelo): UsoDoModelo => {
        const { kMinuto, kDia } = correntes(modelo)
        const min = minutos.get(kMinuto) ?? vazia()
        const dia = dias.get(kDia) ?? vazia()
        const item: UsoDoModelo = {
          modelo,
          minuto: { pedidos: min.pedidos, tokens: min.tokens },
          dia: { pedidos: dia.pedidos, tokens: dia.tokens, rate_limits: dia.rate_limits },
        }
        if (dia.esgotado) item.esgotado_ate = "dia"
        else if (min.esgotado) item.esgotado_ate = "minuto"
        return item
      })
    },

    async apagarAntigas() {
      const agora = clock.now().getTime()
      return apagarDe(minutos, agora - MS_DIA) + apagarDe(dias, agora - 30 * MS_DIA)
    },
  }
}
