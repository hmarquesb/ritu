import { config } from "@config/index"
import { conferirEntrada } from "@/core/guardrails/entrada"
import type { MensagemRecebida } from "@/core/messages/texto"
import { diaLocal } from "@/core/time/dia-local"
import { chavesDeMensagem, segundosAte } from "./chaves"
import { type CodigoDeLimite, LimiteError } from "./erros"
import type { DepsDosLimites, MotivoDoLimite, QuemPede } from "./estado"
import { proximaMeiaNoite } from "./toques"

export type DecisaoDaMensagem =
  | { seguir: "normal" } // contou, tester ou cota de IA esgotada
  | { seguir: "so_atalhos"; motivo: MotivoDoLimite } // não contou; `conversar` com semModelo "limite"
  | { seguir: "alerta"; motivo: MotivoDoLimite } // não contou; `conversar` normal (o guardrail por código responde)
  | { barrar: LimiteError }

type Resultado = "so_atalhos" | "alerta" | "barrado"

const CODIGO: Record<MotivoDoLimite, CodigoDeLimite> = {
  conta: "limite_mensagens",
  demo: "limite_demo",
  ip: "limite_ip",
}

// Ordem: tester, cota de IA do dia, contagem (conta e IP). Quem barra não soma no outro.
export async function decidirMensagem(
  deps: DepsDosLimites,
  q: QuemPede,
  m: MensagemRecebida,
): Promise<DecisaoDaMensagem> {
  if (q.conta.tester) return { seguir: "normal" }
  if (await deps.router.cotaDoDiaEsgotada("decisao")) return { seguir: "normal" }

  const agora = deps.clock.now()
  const { conta, ip } = chavesDeMensagem(q.conta, q.ipHash, agora, q.escopo, q.teto)
  const hoje = diaLocal(agora, config.clima.fusoPadrao)
  const passou = await deps.limiter.consumir([conta, ip], "dia", hoje)
  if (passou.ok) return { seguir: "normal" }

  const motivo: MotivoDoLimite =
    passou.chave === ip.chave ? "ip" : q.conta.tipo === "demo" ? "demo" : "conta"
  return aposBarrar(deps, q, m, motivo)
}

// Sem texto, só os atalhos seguem. Com alerta de saúde ou sofrimento, o guardrail responde.
// Só o resto é barrado com o código e a espera até a virada.
function aposBarrar(
  deps: DepsDosLimites,
  q: QuemPede,
  m: MensagemRecebida,
  motivo: MotivoDoLimite,
): DecisaoDaMensagem {
  const texto = m.texto?.trim() ?? ""
  if (!texto) return marcar(deps, motivo, "so_atalhos", { seguir: "so_atalhos", motivo })
  if (conferirEntrada(texto).resultado === "alerta") {
    return marcar(deps, motivo, "alerta", { seguir: "alerta", motivo })
  }
  const retryAfterS = esperaAte(deps, q, motivo)
  return marcar(deps, motivo, "barrado", {
    barrar: new LimiteError(CODIGO[motivo], retryAfterS),
  })
}

function marcar(
  deps: DepsDosLimites,
  motivo: MotivoDoLimite,
  resultado: Resultado,
  decisao: DecisaoDaMensagem,
): DecisaoDaMensagem {
  deps.telemetry.contador("ritu_limite_total", { tipo: "mensagem", motivo, resultado })
  return decisao
}

// Demonstração: até o fim da sessão, quando existe. Os demais: até a meia-noite do fuso padrão.
function esperaAte(deps: DepsDosLimites, q: QuemPede, motivo: MotivoDoLimite): number {
  const agora = deps.clock.now()
  if (motivo === "demo" && q.conta.expira_em) {
    return segundosAte(agora, new Date(q.conta.expira_em))
  }
  return segundosAte(agora, proximaMeiaNoite(agora, config.clima.fusoPadrao))
}
