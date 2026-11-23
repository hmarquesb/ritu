"use client"

import { config, textosBastidores } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { Copy } from "@phosphor-icons/react"
import { IconButton } from "@/components/base/icon-button"
import { Surface } from "@/components/base/surface"
import { toast } from "@/components/base/toast"

const T = textosBastidores.mcp

function exemplo(endereco: string): string {
  return JSON.stringify({ mcpServers: { ritu: { type: "http", url: endereco } } }, null, 2)
}

async function copiar(endereco: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(endereco)
    toast(T.copiado, { tone: "positive" })
  } catch {
    toast("Não consegui copiar. Selecione o endereço e copie.", { tone: "danger" })
  }
}

/** Seção "Use a base no seu agente": o endereço do MCP, as tools, um exemplo e os limites. */
export function UseOMcp({
  endereco,
  tools,
}: {
  endereco: string
  tools: { nome: string; curta: string }[]
}) {
  const limites = config.limites.mcp
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-body text-ink">{T.texto}</p>

      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink">{T.endereco}</p>
        <Surface
          tone="sunken"
          radius="md"
          padding="none"
          className="flex items-center justify-between gap-2 border border-line py-1 pl-4 pr-1"
        >
          <code className="min-w-0 break-all font-body text-body text-ink">{endereco}</code>
          <IconButton
            icon={Copy}
            aria-label={T.copiar}
            variant="secondary"
            onPress={() => copiar(endereco)}
          />
        </Surface>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-title text-title-sm font-semibold text-ink">{T.tools}</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[48rem]:grid-cols-2">
          {tools.map((tool) => (
            <div key={tool.nome} className="flex flex-col gap-0.5">
              <dt>
                <code className="break-all text-body font-medium text-ink">{tool.nome}</code>
              </dt>
              <dd className="text-body text-ink-muted">{tool.curta}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-title text-title-sm font-semibold text-ink">{T.exemplo}</h3>
        <pre
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a área rola na horizontal e precisa de foco por teclado
          tabIndex={0}
          className="overflow-x-auto rounded-md border border-line bg-sunken p-4 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <code>{exemplo(endereco)}</code>
        </pre>
      </div>

      <p className="text-sm text-ink-muted">
        {formatar(T.limites, { minuto: limites.porIpPorMinuto, dia: limites.porIpPorDia })}
      </p>
    </div>
  )
}
