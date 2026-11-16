import { config } from "@config/index"
import type { Clock } from "@/core/clock"
import type { DemoSeed } from "@/core/demo-seed"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { SugestaoRegistrada } from "@/core/memory-schemas"
import { chaveDeAjuda, fraseDeAjuda } from "@/core/patterns/textos"
import type { Stores } from "@/core/stores"
import { diaLocal, diasAtras } from "@/core/time/dia-local"

const DIA_EM_MS = 86_400_000
type Historico = DemoSeed["historico"][number]
type Sugestao = Historico["saida"]["sugestoes"][number]
type Deps = { clock: Clock; kb: KnowledgeBase }

// Local de propósito: o domínio accounts não pode importar agents (R9).
function sugestaoRegistrada(s: Sugestao): SugestaoRegistrada {
  return {
    tipo: s.tipo,
    ...(s.pratica_id ? { pratica_id: s.pratica_id } : {}),
    ...(s.preparo_id ? { preparo_id: s.preparo_id } : {}),
    alimentos: s.itens.map((item) => item.troca?.alimento_id ?? item.alimento_id),
    titulo: s.titulo,
  }
}

// As notas mais recentes primeiro, até o teto (mesma regra do resumo por código da rotina).
function resumoDaRotina(notas: string[]): string {
  const frases = notas.map((texto) => {
    const limpo = texto.trim()
    const maiuscula = limpo.charAt(0).toUpperCase() + limpo.slice(1)
    return maiuscula.endsWith(".") ? maiuscula : `${maiuscula}.`
  })
  let resumo = ""
  for (const frase of frases.reverse()) {
    const candidato = resumo === "" ? frase : `${resumo} ${frase}`
    if (candidato.length > config.memoria.resumoRotinaCaracteres) break
    resumo = candidato
  }
  return resumo
}

async function copiarPerfil(stores: Stores, contaId: string, seed: DemoSeed): Promise<void> {
  const { perfil } = seed
  await stores.profiles.definirPrakriti(contaId, perfil.prakriti, "quiz")
  await stores.profiles.definirCidade(contaId, perfil.cidade)
  await stores.profiles.acrescentarEvitarSempre(contaId, perfil.evitar_sempre)
  await stores.profiles.definirRestricoes(contaId, perfil.restricoes)
  await stores.profiles.definirNaoCome(contaId, perfil.nao_come)
}

async function copiarGostos(stores: Stores, contaId: string, seed: DemoSeed): Promise<void> {
  for (const p of seed.preferencias) {
    const item = { tipo: p.tipo, id: p.id }
    if (p.gosto) await stores.preferences.definirGosto(contaId, item, p.gosto)
    const contadores = [
      ["ajudou", p.ajudou],
      ["nao_ajudou", p.nao_ajudou],
      ["nao_fez", p.nao_fez],
    ] as const
    for (const [resultado, vezes] of contadores) {
      for (let i = 0; i < (vezes ?? 0); i++) {
        await stores.preferences.contarResultado(contaId, item, resultado)
      }
    }
  }
}

async function copiarConversa(
  stores: Stores,
  contaId: string,
  h: Historico,
  hoje: string,
): Promise<string> {
  const dia = diasAtras(hoje, h.dias_atras)
  const run = await stores.runs.criar(contaId, {
    caminho: "acompanhante",
    intencoes: ["momento"],
    dia,
  })
  await stores.runs.atualizar(contaId, run.id, {
    status: "done",
    momento: {
      estados: h.estados,
      momento_do_dia: h.momento_do_dia,
      gunas_buscadas: h.gunas_buscadas,
    },
    saida: h.saida,
    prompt_versao: "semente",
    juiz_aprovado: true,
  })
  await stores.messages.gravar(contaId, {
    run_id: run.id,
    autor: "pessoa",
    texto: h.mensagem,
    com_incomodo: false,
    dia,
  })
  await stores.messages.gravar(contaId, {
    run_id: run.id,
    autor: "agente",
    texto: h.saida.resposta,
    com_incomodo: false,
    dia,
  })
  const retornos = await stores.outcomes.criar(
    contaId,
    run.id,
    h.saida.sugestoes.map(sugestaoRegistrada),
  )
  for (const [i, retorno] of retornos.entries()) {
    const resultado = h.resultados[i]
    if (resultado && resultado !== "aguardando") {
      await stores.outcomes.responder(contaId, retorno.id, resultado, "toque")
    }
  }
  return dia
}

// O título é o da sugestão do retorno mais recente que usou o item do padrão.
function tituloDoPadrao(seed: DemoSeed): string {
  const { item } = seed.padrao
  const recentes = [...seed.historico].sort((a, b) => a.dias_atras - b.dias_atras)
  for (const h of recentes) {
    const achada = h.saida.sugestoes.find((s) =>
      item.tipo === "pratica" ? s.pratica_id === item.id : s.preparo_id === item.id,
    )
    if (achada) return achada.titulo
  }
  return item.id
}

export async function copiarSeed(
  stores: Stores,
  contaId: string,
  seed: DemoSeed,
  deps: Deps,
): Promise<void> {
  const agora = deps.clock.now()
  const hoje = diaLocal(agora, seed.perfil.cidade.fuso)
  await copiarPerfil(stores, contaId, seed)
  await stores.pantry.semear(
    contaId,
    seed.casa.map((c) => ({
      alimento_id: c.alimento_id,
      confirmado_em: new Date(agora.getTime() - c.dias_atras * DIA_EM_MS),
      ...(c.sempre_tenho ? { sempre_tenho: true } : {}),
    })),
  )
  await copiarGostos(stores, contaId, seed)
  for (const f of seed.faltas) {
    await stores.shortages.registrar(
      contaId,
      [{ alimento_id: f.alimento_id, origem: "teria_entrado" }],
      diasAtras(hoje, f.dias_atras),
    )
  }
  for (const nota of seed.rotina) await stores.routine.anotar(contaId, nota)
  await stores.routine.gravarResumo(contaId, resumoDaRotina(seed.rotina))
  const maisAntigaPrimeiro = [...seed.historico].sort((a, b) => b.dias_atras - a.dias_atras)
  for (const h of maisAntigaPrimeiro) await copiarConversa(stores, contaId, h, hoje)
  await stores.patterns.propor(contaId, {
    tipo: "ajuda_em_estado",
    chave: chaveDeAjuda(seed.padrao.estados, seed.padrao.item),
    frase: fraseDeAjuda(seed.padrao.estados, tituloDoPadrao(seed)),
    ocorrencias: seed.padrao.ocorrencias,
  })
}
