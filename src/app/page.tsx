import { config } from "@config/index"

export default function Home() {
  return (
    <main id="conteudo" className="mx-auto flex max-w-content flex-col gap-4 px-6 py-16">
      <h1 className="font-title text-display text-ink">{config.app.name}</h1>
      <p className="text-prose text-ink">{config.app.disclaimer}</p>
      <p className="text-sm text-ink-muted">Projeto de estudo em construção.</p>
    </main>
  )
}
