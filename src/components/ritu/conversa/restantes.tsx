import { config } from "@config/index"
import type { EstadoDasMensagens } from "@/core/limits/estado"

export function MensagensRestantes({ estado, id }: { estado: EstadoDasMensagens; id: string }) {
  if (estado.tipo !== "contando") return null
  if (estado.restantes > config.limites.mensagens.avisarComRestantes) return null
  if (estado.restantes < 1) return null
  const t = config.textosLimites.restam
  const um = estado.restantes === 1
  const modelo = estado.demo ? (um ? t.umaDemo : t.variasDemo) : um ? t.uma : t.varias
  return (
    <p id={id} className="font-body text-sm text-ink-muted">
      {modelo.replace("{n}", String(estado.restantes))}
    </p>
  )
}
