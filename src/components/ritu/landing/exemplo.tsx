import { textosLanding } from "@config/index"
import { exemploDaLanding } from "@config/textos-landing"
import { Surface } from "@/components/base/surface"
import { FalaDaPessoa, FalaDoAgente } from "@/components/ritu/conversa/fala"
import { BlocoDeSugestao } from "@/components/ritu/conversa/sugestao"
import type { SugestaoNaTela } from "@/core/conversation/visao"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"

const T = textosLanding.exemplo

function nomeDoAlimento(kb: KnowledgeBase, id: string): string {
  return kb.alimento(id)?.nome ?? id
}

// Os blocos da conversa de exemplo, montados só com o que a base diz (nome, como fazer, ingredientes).
export function sugestoesDoExemplo(kb: KnowledgeBase): SugestaoNaTela[] {
  const blocos: SugestaoNaTela[] = []
  for (const ref of exemploDaLanding.sugestoes) {
    const posicao = blocos.length + 1
    const base = { posicao, verbos: [], motivo: "", novidade: false, podeTrocar: false }
    if (ref.tipo === "pratica") {
      const pratica = kb.pratica(ref.id)
      if (!pratica) continue
      blocos.push({
        ...base,
        tipo: pratica.tipo,
        titulo: pratica.nome,
        como_fazer: pratica.preparo,
        itens: pratica.ingredientes.map((id) => ({
          alimento_id: id,
          nome: nomeDoAlimento(kb, id),
          verbos: [],
          incerto: false,
        })),
      })
      continue
    }
    const preparo = kb.preparo(ref.id)
    if (!preparo) continue
    const [principal, , tempero] = ref.ingredientes
    blocos.push({
      ...base,
      tipo: "refeicao",
      titulo: preparo.titulo
        .replace("{base}", nomeDoAlimento(kb, principal).toLocaleLowerCase("pt-BR"))
        .replace("{tempero}", nomeDoAlimento(kb, tempero).toLocaleLowerCase("pt-BR")),
      como_fazer: preparo.passos,
      itens: ref.ingredientes.map((id) => ({
        alimento_id: id,
        nome: nomeDoAlimento(kb, id),
        verbos: [],
        incerto: false,
      })),
    })
  }
  return blocos
}

export function ConversaDeExemplo({ kb }: { kb: KnowledgeBase }) {
  const sugestoes = sugestoesDoExemplo(kb)
  return (
    <section aria-labelledby="exemplo" className="flex flex-col items-center gap-6">
      <h2 id="exemplo" className="font-title text-title text-ink">
        {T.titulo}
      </h2>
      <figure className="w-full max-w-prose">
        <Surface
          tone="surface"
          radius="lg"
          shadow="soft"
          padding="md"
          className="flex flex-col gap-5 border border-line"
        >
          <FalaDaPessoa texto={T.pessoa} />
          <FalaDoAgente texto={T.agente} />
          <div className="flex flex-col gap-3">
            {sugestoes.map((s) => (
              <BlocoDeSugestao key={s.posicao} sugestao={s} exemplo />
            ))}
          </div>
          <p className="text-sm text-ink-muted">{T.aviso}</p>
        </Surface>
        <figcaption className="mt-3 text-sm text-ink-muted">{T.nota}</figcaption>
      </figure>
    </section>
  )
}
