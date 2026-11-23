import { textosSobre } from "@config/index"

export type ItemDoIndice = { id: string; titulo: string }

/** Índice "Nesta página": lista no topo no celular, fixo à esquerda a partir de 64rem. */
export function IndiceDoSobre({ itens }: { itens: readonly ItemDoIndice[] }) {
  return (
    <nav
      aria-label={textosSobre.indice}
      className="min-[64rem]:sticky min-[64rem]:top-6 min-[64rem]:self-start"
    >
      <p className="mb-2 text-sm font-medium text-ink-muted">{textosSobre.indice}</p>
      <ul className="flex flex-col gap-0.5">
        {itens.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex min-h-11 items-center rounded-sm text-ink underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {item.titulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
