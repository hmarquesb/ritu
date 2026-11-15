#!/usr/bin/env node
// Barra de status do Claude Code para o Ritu.
// Mostra o uso da janela de 5 h, da semana e do contexto, e grava o mesmo em
// .local/uso.json para o orquestrador ler antes de cada tarefa (RULES.md §10).
// Não chama rede nem modelo: só lê o JSON que o Claude Code manda no stdin.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

let input = ""
process.stdin.on("data", (chunk) => {
  input += chunk
})
process.stdin.on("end", () => {
  let data = {}
  try {
    data = JSON.parse(input)
  } catch {}

  const window = (w) =>
    w && typeof w.used_percentage === "number"
      ? {
          usado_pct: Math.round(w.used_percentage),
          renova_em: w.resets_at ? new Date(w.resets_at * 1000).toISOString() : null,
        }
      : null

  const uso = {
    atualizado_em: new Date().toISOString(),
    cinco_horas: window(data.rate_limits?.five_hour),
    semana: window(data.rate_limits?.seven_day),
    contexto_pct:
      typeof data.context_window?.used_percentage === "number"
        ? Math.round(data.context_window.used_percentage)
        : null,
    modelo: data.model?.display_name ?? null,
  }

  try {
    mkdirSync(join(root, ".local"), { recursive: true })
    writeFileSync(join(root, ".local", "uso.json"), `${JSON.stringify(uso, null, 2)}\n`)
  } catch {}

  const hora = (iso) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "?"
  const parts = []
  if (uso.modelo) parts.push(uso.modelo)
  if (uso.cinco_horas)
    parts.push(`5h ${uso.cinco_horas.usado_pct}% (renova ${hora(uso.cinco_horas.renova_em)})`)
  if (uso.semana) parts.push(`7d ${uso.semana.usado_pct}%`)
  if (uso.contexto_pct !== null) parts.push(`ctx ${uso.contexto_pct}%`)
  console.log(parts.join(" · ") || "Ritu")
})
