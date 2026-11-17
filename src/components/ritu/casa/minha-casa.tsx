"use client"

import { config } from "@config/index"
import { Plus } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/base/button"
import { StateBlock } from "@/components/base/state-block"
import type { CasaNaTela, ItemNaCasa } from "@/core/pantry/visao"
import { FolhaAdicionar } from "./adicionar"
import { AindaTem } from "./ainda-tem"
import { FolhaDoItem } from "./folha-item"
import { ListaParaTer } from "./lista"
import { Prateleira } from "./prateleira"
import { useCasa } from "./use-casa"

const T = config.textosCasa

// O h2 da seção onde o item está depois do toque; o h1 quando ele saiu da casa.
function tituloDoItem(casa: CasaNaTela, id: string): string {
  if (casa.ainda_tem.some((i) => i.id === id)) return "casa-ainda-tem-titulo"
  const prateleira = casa.prateleiras.find((p) => p.itens.some((i) => i.id === id))
  if (prateleira) return `casa-${prateleira.grupo}-titulo`
  if (casa.acabou.some((i) => i.id === id)) return "casa-acabou-titulo"
  return "casa-titulo"
}

function itemPorId(casa: CasaNaTela, id: string | null): ItemNaCasa | undefined {
  if (id === null) return undefined
  const todos = [...casa.ainda_tem, ...casa.prateleiras.flatMap((p) => p.itens), ...casa.acabou]
  return todos.find((i) => i.id === id)
}

export function MinhaCasa({ inicial }: { inicial: CasaNaTela }) {
  const { casa, pendente, tocar, gostar, lista } = useCasa(inicial)
  const [aberto, setAberto] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [foco, setFoco] = useState<string | null>(null)

  useEffect(() => {
    if (foco === null) return
    // A folha devolve o foco ao botão que a abriu ao sair; o quadro seguinte é o que vale.
    const quadro = requestAnimationFrame(() => {
      document.getElementById(foco)?.focus()
      setFoco(null)
    })
    return () => cancelAnimationFrame(quadro)
  }, [foco])

  const item = itemPorId(casa, aberto)
  const abrirAdicionar = () => setAdicionando(true)
  const mostraLista = !casa.vazia || casa.lista.length > 0

  function depoisDoToque(daFolha: ItemNaCasa, nova: CasaNaTela | undefined) {
    if (!nova) return
    setAberto(null)
    setFoco(tituloDoItem(nova, daFolha.id))
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <h1
          id="casa-titulo"
          tabIndex={-1}
          className="font-title text-title font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {T.titulo}
        </h1>
        <Button variant="secondary" icon={Plus} onPress={abrirAdicionar}>
          {T.adicionar}
        </Button>
      </header>

      <noscript>
        <p className="text-body text-ink">{T.noscript}</p>
      </noscript>

      {casa.vazia ? (
        <StateBlock
          kind="empty"
          title={T.vazia.titulo}
          description={T.vazia.texto}
          action={
            <Button variant="primary" icon={Plus} onPress={abrirAdicionar}>
              {T.adicionar}
            </Button>
          }
        />
      ) : (
        <>
          <AindaTem
            itens={casa.ainda_tem}
            pendente={pendente}
            tocar={tocar}
            onTocou={(daLista, nova) => {
              if (nova) setFoco(tituloDoItem(nova, daLista.id))
            }}
          />
          {casa.prateleiras.map((p) => (
            <Prateleira
              key={p.grupo}
              id={`casa-${p.grupo}`}
              nome={p.nome}
              itens={p.itens}
              onAbrir={setAberto}
            />
          ))}
          {casa.acabou.length > 0 ? (
            <Prateleira
              id="casa-acabou"
              nome={T.prateleira.acabou}
              itens={casa.acabou}
              onAbrir={setAberto}
            />
          ) : null}
        </>
      )}

      {mostraLista ? (
        <ListaParaTer itens={casa.lista} pendente={pendente} tocar={tocar} lista={lista} />
      ) : null}

      <FolhaDoItem
        item={item}
        pendente={pendente}
        tocar={tocar}
        gostar={gostar}
        lista={lista}
        onFechar={() => setAberto(null)}
        onMudou={depoisDoToque}
      />
      <FolhaAdicionar aberta={adicionando} onFechar={() => setAdicionando(false)} tocar={tocar} />
    </div>
  )
}
