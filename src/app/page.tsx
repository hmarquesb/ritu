import { config } from "@config/index"

export default function Home() {
  return (
    <main>
      <h1>{config.app.name}</h1>
      <p>{config.app.disclaimer}</p>
      <p>Projeto de estudo em construção.</p>
    </main>
  )
}
